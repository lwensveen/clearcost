import { db, dutyRatesTable, provenanceTable } from '@clearcost/db';
import { sha256Hex } from '../../../lib/provenance.js';
import { sql } from 'drizzle-orm';

type DutyRateInsertRow = typeof dutyRatesTable.$inferInsert;
type DutyRateSelectRow = typeof dutyRatesTable.$inferSelect;

type ProvOpts = {
  importId?: string;
  makeSourceRef?: (row: DutyRateSelectRow) => string | undefined; // e.g., 'WITS …#series=…'
};

const DEBUG = process.argv.includes('--debug') || process.env.DEBUG === '1';

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
 */
export async function batchUpsertDutyRatesFromStream(
  source: AsyncIterable<DutyRateInsertRow> | DutyRateInsertRow[],
  opts: { batchSize?: number; dryRun?: boolean } & ProvOpts = {}
) {
  const batchSize = Math.max(1, opts.batchSize ?? 5000);

  let buf: DutyRateInsertRow[] = [];
  let totalInserted = 0;
  let totalUpdated = 0;

  async function flush() {
    if (buf.length === 0) return;

    // Normalize partner to '' (MFN sentinel) for NOT NULL + unique composite
    const rows = buf.map((r) => ({ ...r, partner: r.partner ?? '' }));

    if (opts.dryRun) {
      if (DEBUG) console.log(`[Duties] DRY-RUN: would upsert ${rows.length} rows`);
      totalInserted += rows.length; // count hypothetical inserts
      buf = [];
      return;
    }

    // Perform upsert with change-detection + inserted/updated split
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
          updatedAt: sql`now()`,
        },
        // Avoid pointless writes when nothing changed
        setWhere: sql`
          ${dutyRatesTable.ratePct} IS DISTINCT FROM EXCLUDED.rate_pct
          OR ${dutyRatesTable.effectiveTo} IS DISTINCT FROM EXCLUDED.effective_to
          OR ${dutyRatesTable.notes} IS DISTINCT FROM EXCLUDED.notes
        `,
      })
      .returning({
        id: dutyRatesTable.id,
        inserted: sql<number>`(xmax = 0)::int`,
        // fields for provenance hash / sourceRef builder
        dest: dutyRatesTable.dest,
        partner: dutyRatesTable.partner,
        hs6: dutyRatesTable.hs6,
        dutyRule: dutyRatesTable.dutyRule,
        ratePct: dutyRatesTable.ratePct,
        effectiveFrom: dutyRatesTable.effectiveFrom,
        effectiveTo: dutyRatesTable.effectiveTo,
        notes: dutyRatesTable.notes,
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
        `[Duties] Upsert batch: inserted=${batchInserted}, updated=${batchUpdated}, total=${totalInserted + totalUpdated}`
      );
    }

    // Provenance (only for actually written rows)
    if (opts.importId && ret.length) {
      const provRows = ret.map((row) => ({
        importId: opts.importId!,
        resourceType: 'duty_rate' as const,
        resourceId: row.id,
        sourceRef: opts.makeSourceRef?.(row as unknown as DutyRateSelectRow),
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
          })
        ),
      }));
      await db.insert(provenanceTable).values(provRows);
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
