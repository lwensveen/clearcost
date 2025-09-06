import type { DutyRateInsert } from '@clearcost/types';
import { batchUpsertDutyRatesFromStream } from '../../utils/batch-upsert.js';
import { fetchWitsMfnDutyRates } from '../wits/mfn.js';

type Params = {
  hs6List?: string[];
  batchSize?: number;
  importId?: string;
  dryRun?: boolean;
  useWitsFallback?: boolean;
};

async function fetchJpMfnOfficial(_hs6List?: string[]): Promise<DutyRateInsert[]> {
  // Placeholder: return [] until we have a METI/Customs bulk feed
  return [];
}

export async function importJpMfn({
  hs6List,
  batchSize = 5_000,
  importId,
  dryRun,
  useWitsFallback = true,
}: Params) {
  const officialRows = await fetchJpMfnOfficial(hs6List);

  let witsRows: DutyRateInsert[] = [];
  if (useWitsFallback) {
    witsRows = await fetchWitsMfnDutyRates({ dest: 'JP', backfillYears: 1, hs6List });
  }

  const merged = [...officialRows, ...witsRows];

  if (merged.length === 0) {
    return { ok: true as const, inserted: 0, updated: 0, count: 0, dryRun: Boolean(dryRun) };
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
