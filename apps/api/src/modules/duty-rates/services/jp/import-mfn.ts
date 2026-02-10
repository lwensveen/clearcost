import type { DutyRateInsert } from '@clearcost/types';
import { batchUpsertDutyRatesFromStream } from '../../utils/batch-upsert.js';
import { fetchJpMfnDutyRates } from './fetch-mfn.js';
import { fetchWitsMfnDutyRates } from '../wits/mfn.js';

type Params = {
  hs6List?: string[];
  batchSize?: number;
  importId?: string;
  dryRun?: boolean;
  useWitsFallback?: boolean;
};

export async function importJpMfn({
  hs6List,
  batchSize = 5_000,
  importId,
  dryRun,
  useWitsFallback = true,
}: Params) {
  const officialRows = await fetchJpMfnDutyRates({ hs6List });

  let witsRows: DutyRateInsert[] = [];
  if (useWitsFallback) {
    witsRows = await fetchWitsMfnDutyRates({ dest: 'JP', backfillYears: 1, hs6List });
  }

  const merged = [...officialRows, ...witsRows];

  if (merged.length === 0) {
    throw new Error(
      '[JP Duties] MFN produced 0 rows. Check WITS fallback availability and parser compatibility.'
    );
  }

  const res = await batchUpsertDutyRatesFromStream(merged, {
    batchSize,
    importId,
    dryRun,
    source: 'wits',
    makeSourceRef: (r) =>
      r.partner && r.partner !== '' ? `jp:${r.partner}:fta:${r.hs6}` : `jp:erga:mfn:${r.hs6}`,
  });

  return {
    ok: true as const,
    inserted: res.inserted,
    updated: res.updated,
    count: res.count,
    dryRun: res.dryRun,
  };
}
