import { db, provenanceTable, surchargesTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import { sha256Hex } from '../../../lib/provenance.js';

type SurchargeInsertRow = typeof surchargesTable.$inferInsert;
type SurchargeSelectRow = typeof surchargesTable.$inferSelect;

type ProvOpts = {
  importId?: string;
  makeSourceRef?: (row: SurchargeSelectRow) => string | undefined;
};

/**
 * Upsert surcharges from a stream or array in batches (default 5k),
 * optionally recording provenance rows.
 * TODO add dry run
 */
export async function batchUpsertSurchargesFromStream(
  source: AsyncIterable<SurchargeInsertRow> | SurchargeInsertRow[],
  opts: { batchSize?: number } & ProvOpts = {}
) {
  const batchSize = Math.max(1, opts.batchSize ?? 5000);
  let total = 0;
  let buf: SurchargeInsertRow[] = [];

  const isAsyncIterable = (s: any): s is AsyncIterable<SurchargeInsertRow> =>
    s && typeof s[Symbol.asyncIterator] === 'function';

  async function flush() {
    if (buf.length === 0) return;

    // Upsert + return full typed rows so we have the row IDs for provenance.
    const rows = await db
      .insert(surchargesTable)
      .values(buf)
      .onConflictDoUpdate({
        target: [
          surchargesTable.dest,
          surchargesTable.origin,
          surchargesTable.hs6,
          surchargesTable.code,
          surchargesTable.effectiveFrom,
        ],
        set: {
          fixedAmt: sql`EXCLUDED.fixed_amt`,
          pctAmt: sql`EXCLUDED.pct_amt`,
          effectiveTo: sql`EXCLUDED.effective_to`,
          notes: sql`EXCLUDED.notes`,
          updatedAt: new Date(),
        },
      })
      .returning(); // => SurchargeSelectRow[]

    total += rows.length;

    // Optional provenance
    if (opts.importId && rows.length) {
      const provRows = rows.map((row) => ({
        importId: opts.importId!,
        resourceType: 'surcharge' as const,
        resourceId: row.id,
        sourceRef: opts.makeSourceRef?.(row),
        rowHash: sha256Hex(
          JSON.stringify({
            dest: row.dest,
            origin: row.origin ?? null,
            hs6: row.hs6 ?? null,
            code: row.code,
            fixedAmt: row.fixedAmt ?? null,
            pctAmt: row.pctAmt ?? null,
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

  return { ok: true as const, count: total };
}
