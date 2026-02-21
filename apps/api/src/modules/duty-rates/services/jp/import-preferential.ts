import type { DutyRateInsert } from '@clearcost/types';
import { batchUpsertDutyRatesFromStream } from '../../utils/batch-upsert.js';
import { fetchWitsPreferentialDutyRates } from '../wits/preferential.js';
import { fetchJpPreferentialDutyRates } from './fetch-preferential.js';

type Params = {
  hs6List?: string[];
  partnerGeoIds?: string[];
  batchSize?: number;
  importId?: string;
  dryRun?: boolean;
  useWitsFallback?: boolean;
};

export const JP_FTA_DEFAULT_PARTNER_GEOIDS = [
  'CN',
  'KR',
  'AU',
  'NZ',
  'TH',
  'MY',
  'ID',
  'PH',
  'VN',
  'LA',
  'KH',
  'BN',
  'SG',
  'CA',
  'MX',
  'EU',
  'GB',
  'US',
] as const;

function normalizePartnerGeoIds(partnerGeoIds?: string[]): string[] {
  const raw =
    partnerGeoIds && partnerGeoIds.length > 0 ? partnerGeoIds : [...JP_FTA_DEFAULT_PARTNER_GEOIDS];
  const out = new Set<string>();
  for (const partner of raw) {
    const normalized = String(partner ?? '')
      .trim()
      .toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalized)) continue;
    out.add(normalized);
  }
  return [...out];
}

async function fetchJpPreferentialFromWits(
  partners: string[],
  hs6List?: string[]
): Promise<DutyRateInsert[]> {
  const witsRows: DutyRateInsert[] = [];
  for (const partner of partners) {
    const rows = await fetchWitsPreferentialDutyRates({
      dest: 'JP',
      partner,
      backfillYears: 1,
      hs6List,
    });
    witsRows.push(...rows);
  }
  return witsRows;
}

export async function importJpPreferentialFromWits({
  hs6List,
  partnerGeoIds,
  batchSize = 5_000,
  importId,
  dryRun,
}: Params) {
  const partners = normalizePartnerGeoIds(partnerGeoIds);
  const witsRows = await fetchJpPreferentialFromWits(partners, hs6List);
  if (witsRows.length === 0) {
    throw new Error('[JP Duties] Preferential produced 0 rows from WITS source.');
  }

  const res = await batchUpsertDutyRatesFromStream(witsRows, {
    batchSize,
    importId,
    dryRun,
    makeSourceRef: (r) =>
      [
        'wits',
        'JP',
        r.partner && r.partner !== '' ? r.partner : 'ERGA',
        r.dutyRule ?? 'fta',
        r.hs6,
      ].join(':'),
  });

  return {
    ok: true as const,
    inserted: res.inserted,
    updated: res.updated,
    count: res.count,
    dryRun: !!res.dryRun,
  };
}

export async function importJpPreferential({
  hs6List,
  partnerGeoIds,
  batchSize = 5_000,
  importId,
  dryRun,
  useWitsFallback = true,
}: Params) {
  const partners = normalizePartnerGeoIds(partnerGeoIds);
  const officialRows = await fetchJpPreferentialDutyRates({ hs6List, partnerGeoIds: partners });

  let witsRows: DutyRateInsert[] = [];
  if (useWitsFallback) {
    const officialPartners = new Set(officialRows.map((row) => row.partner).filter(Boolean));
    const missingPartners = partners.filter((partner) => !officialPartners.has(partner));
    if (missingPartners.length > 0) {
      witsRows = await fetchJpPreferentialFromWits(missingPartners, hs6List);
    }
  }

  const merged = [...officialRows, ...witsRows];
  if (merged.length === 0) {
    if (useWitsFallback) {
      throw new Error('[JP Duties] Preferential produced 0 rows from official and WITS sources.');
    }
    throw new Error('[JP Duties] Preferential produced 0 rows from official source.');
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
        r.dutyRule ?? 'fta',
        r.hs6,
      ].join(':'),
  });

  return {
    ok: true as const,
    inserted: res.inserted,
    updated: res.updated,
    count: res.count,
    dryRun: !!res.dryRun,
  };
}
