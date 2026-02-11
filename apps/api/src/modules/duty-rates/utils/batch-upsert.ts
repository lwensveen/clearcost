import { db, dutyRatesTable, provenanceTable } from '@clearcost/db';
import { sha256Hex } from '../../../lib/provenance.js';
import { sql } from 'drizzle-orm';
import { DEBUG } from './utils.js';
import { resolveDutyRateCurrency } from './currency.js';

type DutyRateInsertRow = typeof dutyRatesTable.$inferInsert;
type DutyRateSelectRow = typeof dutyRatesTable.$inferSelect;

type ProvOpts = {
  importId?: string;
  makeSourceRef?: (row: DutyRateSelectRow) => string | undefined; // e.g., 'wits:US:ERGA:mfn:hs6=010121:y=2022'
};

const clamp = (s: string | undefined | null, max = 255) =>
  typeof s === 'string' ? s.slice(0, max) : undefined;

function isoOrNull(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString();
  const dd = new Date(d);
  return Number.isNaN(+dd) ? null : dd.toISOString();
}

/**
 * Upsert duty rates from a stream or array in batches (default 5,000).
 * Optionally records provenance rows linked to an importId.
 * Returns inserted/updated counts separately.
 *
 * opts.source: tag rows as 'official' | 'wits' | 'vendor' | 'manual' (defaults to 'official')
 * - WITS rows will not overwrite existing OFFICIAL rows.
 * - OFFICIAL rows can overwrite WITS (and others).
 */
export async function batchUpsertDutyRatesFromStream(
  source: AsyncIterable<DutyRateInsertRow> | DutyRateInsertRow[],
  opts: {
    batchSize?: number;
    dryRun?: boolean;
    source?: DutyRateInsertRow['source'];
  } & ProvOpts = {}
) {
  const batchSize = Math.max(1, opts.batchSize ?? 5000);

  let buf: DutyRateInsertRow[] = [];
  let totalInserted = 0;
  let totalUpdated = 0;

  async function flush() {
    if (buf.length === 0) return;

    // Normalize partner to '' (MFN sentinel) and apply source default
    const rows = buf.map((r) => ({
      ...r,
      dest: String(r.dest).toUpperCase(),
      partner: r.partner ?? '',
      source: r.source ?? opts.source ?? 'official',
      currency: resolveDutyRateCurrency(String(r.dest), r.currency ?? null),
    }));

    if (opts.dryRun) {
      if (DEBUG) console.log(`[Duties] DRY-RUN: would upsert ${rows.length} rows`);
      totalInserted += rows.length;
      buf = [];
      return;
    }

    const ret = await db
      .insert(dutyRatesTable)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          dutyRatesTable.dest,
          dutyRatesTable.partner,
          dutyRatesTable.hs6,
          dutyRatesTable.dutyRule,
          dutyRatesTable.effectiveFrom,
        ],
        set: {
          ratePct: sql`EXCLUDED.rate_pct`,
          effectiveTo: sql`EXCLUDED.effective_to`,
          notes: sql`EXCLUDED.notes`,
          currency: sql`EXCLUDED.currency`,
          source: sql`EXCLUDED.source`,
          updatedAt: sql`now()`,
        },
        // Block WITS from overwriting OFFICIAL; allow OFFICIAL to overwrite others; skip no-op writes
        setWhere: sql`
          (
            ${dutyRatesTable.source} = EXCLUDED.source
            OR ${dutyRatesTable.source} <> 'official'
          )
          AND (
            ${dutyRatesTable.ratePct} IS DISTINCT FROM EXCLUDED.rate_pct
            OR ${dutyRatesTable.effectiveTo} IS DISTINCT FROM EXCLUDED.effective_to
            OR ${dutyRatesTable.notes} IS DISTINCT FROM EXCLUDED.notes
            OR ${dutyRatesTable.currency} IS DISTINCT FROM EXCLUDED.currency
            OR ${dutyRatesTable.source} IS DISTINCT FROM EXCLUDED.source
          )
        `,
      })
      .returning({
        id: dutyRatesTable.id,
        inserted: sql<number>`(xmax = 0)::int`,
        dest: dutyRatesTable.dest,
        partner: dutyRatesTable.partner,
        hs6: dutyRatesTable.hs6,
        dutyRule: dutyRatesTable.dutyRule,
        ratePct: dutyRatesTable.ratePct,
        effectiveFrom: dutyRatesTable.effectiveFrom,
        effectiveTo: dutyRatesTable.effectiveTo,
        notes: dutyRatesTable.notes,
        source: dutyRatesTable.source,
        currency: dutyRatesTable.currency,
      });

    let batchInserted = 0;
    let batchUpdated = 0;
    for (const r of ret) {
      if (r.inserted === 1) batchInserted++;
      else batchUpdated++;
    }
    totalInserted += batchInserted;
    totalUpdated += batchUpdated;

    if (DEBUG) {
      console.log(
        `[Duties] Upsert batch: inserted=${batchInserted}, updated=${batchUpdated}, total=${
          totalInserted + totalUpdated
        }`
      );
    }

    // Provenance (only for actually written rows)
    if (opts.importId && ret.length) {
      const provRows = ret.map((row) => {
        const built = opts.makeSourceRef?.(row as unknown as DutyRateSelectRow);
        const sourceRef = clamp(built, 255); // keep within DB limits

        return {
          importId: opts.importId!,
          resourceType: 'duty_rate' as const,
          resourceId: row.id,
          sourceRef,
          rowHash: sha256Hex(
            JSON.stringify({
              dest: row.dest,
              partner: row.partner ?? '',
              hs6: row.hs6,
              dutyRule: row.dutyRule,
              ratePct: row.ratePct,
              ef: isoOrNull(row.effectiveFrom),
              et: isoOrNull(row.effectiveTo),
              notes: row.notes ?? null,
              source: row.source ?? 'official',
              currency: row.currency ?? null,
            })
          ),
        };
      });

      try {
        await db.insert(provenanceTable).values(provRows);
      } catch (e) {
        if (DEBUG) {
          console.warn('[Duties] provenance insert failed (non-fatal):', (e as Error).message);
        }
      }
    }

    buf = [];
  }

  const isAsyncIterable = (s: any): s is AsyncIterable<DutyRateInsertRow> =>
    s && typeof s[Symbol.asyncIterator] === 'function';

  if (isAsyncIterable(source)) {
    for await (const row of source) {
      buf.push(row);
      if (buf.length >= batchSize) await flush();
    }
  } else {
    for (const row of source) {
      buf.push(row);
      if (buf.length >= batchSize) await flush();
    }
  }

  await flush();

  const result = {
    ok: true as const,
    inserted: totalInserted,
    updated: totalUpdated,
    count: totalInserted + totalUpdated,
    dryRun: Boolean(opts.dryRun),
  };

  if (DEBUG) console.log('[Duties] Upsert summary', result);
  return result;
}
