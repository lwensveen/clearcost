import { db, dutyRatesTable, provenanceTable } from '@clearcost/db';
import { sha256Hex } from '../../../lib/provenance.js';
import { sql } from 'drizzle-orm';

type DutyRateInsertRow = typeof dutyRatesTable.$inferInsert;
type DutyRateSelectRow = typeof dutyRatesTable.$inferSelect;

type ProvOpts = {
  importId?: string;
  makeSourceRef?: (row: DutyRateSelectRow) => string | undefined; // e.g., 'WITS …#series=…'
};

/**
 * Upsert duty rates from a stream or array in batches (default 5,000).
 * Optionally records provenance rows linked to an importId.
 */
export async function batchUpsertDutyRatesFromStream(
  source: AsyncIterable<DutyRateInsertRow> | DutyRateInsertRow[],
  opts: { batchSize?: number; dryRun?: boolean } & ProvOpts = {}
) {
  const batchSize = Math.max(1, opts.batchSize ?? 5000);
  let total = 0;
  let buf: DutyRateInsertRow[] = [];

  async function flush() {
    if (buf.length === 0) return;

    if (opts.dryRun) {
      total += buf.length;
      buf = [];
      return;
    }

    const rows = await db
      .insert(dutyRatesTable)
      .values(buf)
      .onConflictDoUpdate({
        target: [
          dutyRatesTable.dest,
          dutyRatesTable.hs6,
          dutyRatesTable.rule,
          dutyRatesTable.effectiveFrom,
        ],
        set: {
          ratePct: sql`EXCLUDED.rate_pct`,
          effectiveTo: sql`EXCLUDED.effective_to`,
          notes: sql`EXCLUDED.notes`,
          updatedAt: new Date(),
        },
      })
      .returning();

    total += rows.length;

    if (opts.importId && rows.length) {
      const provRows = rows.map((row) => ({
        importId: opts.importId!,
        resourceType: 'duty_rate' as const,
        resourceId: row.id,
        sourceRef: opts.makeSourceRef?.(row),
        rowHash: sha256Hex(
          JSON.stringify({
            dest: row.dest,
            hs6: row.hs6,
            rule: row.rule,
            ratePct: row.ratePct,
            ef: row.effectiveFrom?.toISOString(),
            et: row.effectiveTo ? row.effectiveTo.toISOString() : null,
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
  return { ok: true as const, inserted: total, dryRun: Boolean(opts.dryRun) };
}
