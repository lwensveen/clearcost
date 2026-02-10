import type { DutyRateInsert } from '@clearcost/types';
import { batchUpsertDutyRatesFromStream } from '../../utils/batch-upsert.js';
import { fetchJpMfnDutyRates } from './fetch-mfn.js';
import { fetchWitsMfnDutyRates } from '../wits/mfn.js';

type Params = {
  hs6List?: string[];
  batchSize?: number;
  importId?: string;
  dryRun?: boolean;
  useWitsFallback?: boolean; // default false (official-first)
};

export async function importJpMfn({
  hs6List,
  batchSize = 5_000,
  importId,
  dryRun,
  useWitsFallback = false,
}: Params) {
  const officialRows = await fetchJpMfnDutyRates({ hs6List });

  let witsRows: DutyRateInsert[] = [];
  if (useWitsFallback) {
    witsRows = await fetchWitsMfnDutyRates({ dest: 'JP', backfillYears: 1, hs6List });
  }

  const merged = [...officialRows, ...witsRows];

  if (merged.length === 0) {
    if (useWitsFallback) {
      throw new Error('[JP Duties] MFN produced 0 rows from official and WITS fallback sources.');
    }
    throw new Error('[JP Duties] MFN produced 0 official rows.');
  }

  const res = await batchUpsertDutyRatesFromStream(merged, {
    batchSize,
    importId,
    dryRun,
    makeSourceRef: (r) =>
      [
        r.source === 'wits' ? 'wits' : 'jp-customs',
        'JP',
        r.partner && r.partner !== '' ? r.partner : 'ERGA',
        r.dutyRule ?? 'mfn',
        r.hs6,
      ].join(':'),
  });

  return {
    ok: true as const,
    inserted: res.inserted,
    updated: res.updated,
    count: res.count,
    dryRun: res.dryRun,
  };
}
