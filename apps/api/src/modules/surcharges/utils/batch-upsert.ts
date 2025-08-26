import type { SurchargeInsert } from '@clearcost/types';
import { importSurcharges } from '../services/import-surcharges.js';

/**
 * Upsert SurchargeInsert rows in batches to keep memory flat.
 * Accepts an AsyncIterable<SurchargeInsert> (stream) or an array.
 * Defaults to 5k rows/transaction.
 */
export async function batchUpsertSurchargesFromStream(
  source: AsyncIterable<SurchargeInsert> | SurchargeInsert[],
  opts: { batchSize?: number } = {}
) {
  const batchSize = Math.max(1, opts.batchSize ?? 5000);
  let total = 0;
  let buf: SurchargeInsert[] = [];

  async function flush() {
    if (buf.length === 0) return;
    const res = await importSurcharges(buf);
    total += res.count ?? buf.length;
    buf = [];
  }

  // Stream mode
  if (Symbol.asyncIterator in Object(source)) {
    for await (const row of source as AsyncIterable<SurchargeInsert>) {
      buf.push(row);
      if (buf.length >= batchSize) await flush();
    }
    await flush();
  } else {
    // Array mode
    for (const row of source as SurchargeInsert[]) {
      buf.push(row);
      if (buf.length >= batchSize) await flush();
    }
    await flush();
  }

  return { ok: true as const, inserted: total };
}
