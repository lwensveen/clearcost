// UK duty-rates import orchestrator (MFN + Preferential) with batched upserts.
//
// Why this?
// - Streams rows from the DBT Data API (S3-Select when available, CSV streaming otherwise).
// - Pipes each stream directly into your batchUpsertDutyRatesFromStream, so we never
//   hold the whole dataset in memory.
// - Lets you choose MFN / FTA / both, filter HS6, and narrow preferential by partners.
//
// Usage:
//   await importDutyRatesFromUK(); // both MFN + FTA
//   await importDutyRatesFromUK({ include: 'mfn', hs6List: ['950300','640399'] });
//   await importDutyRatesFromUK({ include: 'fta', partners: ['Japan','1013'], batchSize: 3000 });

import { z } from 'zod/v4';
import { batchUpsertDutyRatesFromStream } from '../../utils/batch-upsert.js';
import { streamUkMfnDutyRates } from './mfn.js';
import { streamUkPreferentialDutyRates } from './preferential.js';

const ParamsSchema = z.object({
  /** Which datasets to ingest. Default "both". */
  include: z.enum(['mfn', 'fta', 'both']).default('both'),
  /** Optional HS6 allowlist to reduce scope. */
  hs6List: z.array(z.string().regex(/^\d{6}$/)).optional(),
  /**
   * Preferential-only partner filters (either numeric geo ids like "1013",
   * or name fragments like "Japan", case-insensitive).
   */
  partners: z.array(z.string().min(1)).optional(),
  /** DB upsert batch size (rows per transaction). Default 5000. */
  batchSize: z.number().int().min(1).max(20000).default(5000),
});

export type ImportFromUkParams = z.infer<typeof ParamsSchema>;

export async function importDutyRatesFromUK(params: ImportFromUkParams) {
  const p = ParamsSchema.parse(params);

  const jobs: Promise<{ ok: true; inserted: number }>[] = [];

  if (p.include === 'mfn' || p.include === 'both') {
    const mfnStream = streamUkMfnDutyRates({ hs6List: p.hs6List });
    jobs.push(batchUpsertDutyRatesFromStream(mfnStream, { batchSize: p.batchSize }));
  }

  if (p.include === 'fta' || p.include === 'both') {
    const ftaStream = streamUkPreferentialDutyRates({ hs6List: p.hs6List, partners: p.partners });
    jobs.push(batchUpsertDutyRatesFromStream(ftaStream, { batchSize: p.batchSize }));
  }

  if (jobs.length === 0) return { ok: true, inserted: 0, message: 'No UK import selected.' };

  const results = await Promise.all(jobs);
  const inserted = results.reduce((s, r) => s + (r.inserted ?? 0), 0);
  return { ok: true, inserted };
}
