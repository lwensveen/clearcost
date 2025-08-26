// EU duty-rates import orchestrator (MFN + Preferential) with batched upserts.
//
// Usage examples:
//   await importDutyRatesFromEU({ include: 'mfn' });
//   await importDutyRatesFromEU({ include: 'fta', partnerGeoIds: ['JP', 'TR', '1013'] });
//   await importDutyRatesFromEU({ include: 'both', hs6List: ['950300', '640399'], batchSize: 5000 });
//
// Notes:
// - This orchestrator intentionally keeps memory flat by upserting each chunk as soon as it's fetched.
// - If you later expose true streaming parsers for TARIC, you can pass the async generators directly
//   to batchUpsertDutyRatesFromStream; the interface here won’t need to change.

import { z } from 'zod/v4';
import type { DutyRateInsert } from '@clearcost/types';
import { fetchEuMfnDutyRates } from './mfn.js';
import { batchUpsertDutyRatesFromStream } from '../../utils/batch-upsert.js';
import { fetchEuPreferentialDutyRates } from './preferential.js';

const ParamsSchema = z.object({
  /** Which datasets to ingest. */
  include: z.enum(['mfn', 'fta', 'both']).default('both'),

  /** Optional HS6 allowlist to reduce scope. */
  hs6List: z.array(z.string().regex(/^\d{6}$/)).optional(),

  /** Preferential-only: TARIC geo ids to include (e.g., 'JP', 'TR', '1013', etc.). */
  partnerGeoIds: z.array(z.string()).optional(),

  /** Batch size for DB upserts (default: 5k). */
  batchSize: z.number().int().min(1).max(20000).optional(),

  /** Optional XML overrides + language (defaults read from env in the fetchers). */
  xml: z
    .object({
      measureUrl: z.string().url().optional(),
      componentUrl: z.string().url().optional(),
      geoDescUrl: z.string().url().optional(),
      dutyExprUrl: z.string().url().optional(),
      language: z.string().min(2).max(5).optional(), // e.g., 'EN', 'FR'
    })
    .optional(),
});

export type ImportFromEuParams = z.infer<typeof ParamsSchema>;

export async function importDutyRatesFromEU(params: ImportFromEuParams) {
  const p = ParamsSchema.parse(params);
  const batchSize = p.batchSize ?? 5000;

  let inserted = 0;

  // Helper to feed arrays into the batch upserter without holding everything at once.
  async function upsertArray(rows: DutyRateInsert[]) {
    if (rows.length === 0) return;
    // This will split into transactions of `batchSize` rows internally.
    const res = await batchUpsertDutyRatesFromStream(rows, { batchSize });
    inserted += res.inserted;
  }

  // --- MFN (ERGA OMNES) ---
  if (p.include === 'mfn' || p.include === 'both') {
    const mfnRows = await fetchEuMfnDutyRates({
      hs6List: p.hs6List,
      xmlMeasureUrl: p.xml?.measureUrl,
      xmlComponentUrl: p.xml?.componentUrl,
      xmlDutyExprUrl: p.xml?.dutyExprUrl,
      language: p.xml?.language,
    });
    await upsertArray(mfnRows);
  }

  // --- Preferential (FTA) ---
  if (p.include === 'fta' || p.include === 'both') {
    const prefRows = await fetchEuPreferentialDutyRates({
      hs6List: p.hs6List,
      partnerGeoIds: p.partnerGeoIds,
      xmlMeasureUrl: p.xml?.measureUrl,
      xmlComponentUrl: p.xml?.componentUrl,
      xmlGeoDescUrl: p.xml?.geoDescUrl,
      xmlDutyExprUrl: p.xml?.dutyExprUrl,
      language: p.xml?.language,
    });
    await upsertArray(prefRows);
  }

  return { ok: true, inserted };
}
