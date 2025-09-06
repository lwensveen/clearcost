import type { DutyRateInsert } from '@clearcost/types';
import { batchUpsertDutyRatesFromStream } from '../../utils/batch-upsert.js';
import { fetchWitsPreferentialDutyRates } from '../wits/preferential.js';

type Params = {
  hs6List?: string[];
  partnerGeoIds?: string[];
  batchSize?: number;
  importId?: string;
  dryRun?: boolean;
  useWitsFallback?: boolean; // default true
};

async function fetchJpPreferentialOfficial(
  _partners?: string[],
  _hs6List?: string[]
): Promise<DutyRateInsert[]> {
  // Placeholder until an official JP feed is wired
  return [];
}

export async function importJpPreferential({
  hs6List,
  partnerGeoIds,
  batchSize = 5_000,
  importId,
  dryRun,
  useWitsFallback = true,
}: Params) {
  const officialRows = await fetchJpPreferentialOfficial(partnerGeoIds, hs6List);

  const witsRows: DutyRateInsert[] = [];
  if (useWitsFallback) {
    const partners = partnerGeoIds ?? [];
    for (const partner of partners) {
      const rows = await fetchWitsPreferentialDutyRates({
        dest: 'JP',
        partner,
        backfillYears: 1,
        hs6List,
      }).catch(() => [] as DutyRateInsert[]);
      witsRows.push(...rows);
    }
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
    dryRun: !!res.dryRun,
  };
}
