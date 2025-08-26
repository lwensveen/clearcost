import type { DutyRateInsert } from '@clearcost/types';
import { importDutyRates } from '../services/import-duty-rates.js';

/**
 * Consume a stream or array of DutyRateInsert and upsert in batches to keep memory flat.
 * Defaults to 5,000 rows per transaction; tune via batchSize.
 */
export async function batchUpsertDutyRatesFromStream(
  source: AsyncIterable<DutyRateInsert> | DutyRateInsert[],
  opts: { batchSize?: number } = {}
) {
  const batchSize = Math.max(1, opts.batchSize ?? 5000);
  let total = 0;
  let buf: DutyRateInsert[] = [];

  async function flush() {
    if (buf.length === 0) return;
    const res = await importDutyRates(buf);
    total += res.count ?? buf.length;
    buf = [];
  }

  if (Symbol.asyncIterator in Object(source)) {
    for await (const row of source as AsyncIterable<DutyRateInsert>) {
      buf.push(row);
      if (buf.length >= batchSize) await flush();
    }
    await flush();
  } else {
    for (const row of source as DutyRateInsert[]) {
      buf.push(row);
      if (buf.length >= batchSize) await flush();
    }
    await flush();
  }

  return { ok: true, inserted: total } as const;
}
