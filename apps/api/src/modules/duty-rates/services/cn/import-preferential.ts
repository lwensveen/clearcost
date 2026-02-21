import type { DutyRateInsert } from '@clearcost/types';
import { batchUpsertDutyRatesFromStream } from '../../utils/batch-upsert.js';
import { fetchWitsPreferentialDutyRates } from '../wits/preferential.js';
import { fetchCnPreferentialDutyRates } from './fetch-preferential.js';
import { resolveCnPreferentialDutySourceUrls } from './source-urls.js';

type Params = {
  hs6List?: string[];
  partnerGeoIds?: string[];
  batchSize?: number;
  importId?: string;
  dryRun?: boolean;
  useWitsFallback?: boolean;
  officialExcelUrl?: string;
  sheet?: string | number;
};

export const CN_FTA_DEFAULT_PARTNER_GEOIDS = [
  'AU',
  'BN',
  'CH',
  'CR',
  'ID',
  'IS',
  'KH',
  'KR',
  'LA',
  'MU',
  'MY',
  'NZ',
  'PE',
  'PH',
  'PK',
  'SG',
  'TH',
  'VN',
] as const;

function normalizePartnerGeoIds(partnerGeoIds?: string[]): string[] {
  const raw =
    partnerGeoIds && partnerGeoIds.length > 0 ? partnerGeoIds : [...CN_FTA_DEFAULT_PARTNER_GEOIDS];
  const out = new Set<string>();
  for (const partner of raw) {
    const normalized = String(partner ?? '')
      .trim()
      .toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalized) && normalized !== 'EU') continue;
    out.add(normalized);
  }
  return [...out];
}

async function fetchCnPreferentialFromWits(
  partners: string[],
  hs6List?: string[]
): Promise<DutyRateInsert[]> {
  const witsRows: DutyRateInsert[] = [];
  for (const partner of partners) {
    const rows = await fetchWitsPreferentialDutyRates({
      dest: 'CN',
      partner,
      backfillYears: 1,
      hs6List,
    });
    witsRows.push(...rows);
  }
  return witsRows;
}

export async function importCnPreferentialFromWits({
  hs6List,
  partnerGeoIds,
  batchSize = 5_000,
  importId,
  dryRun,
}: Params) {
  const partners = normalizePartnerGeoIds(partnerGeoIds);
  const witsRows = await fetchCnPreferentialFromWits(partners, hs6List);
  if (witsRows.length === 0) {
    throw new Error('[CN Duties] Preferential produced 0 rows from WITS source.');
  }

  const res = await batchUpsertDutyRatesFromStream(witsRows, {
    batchSize,
    importId,
    dryRun,
    makeSourceRef: (r) =>
      [
        'wits',
        'CN',
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

export async function importCnPreferential({
  hs6List,
  partnerGeoIds,
  batchSize = 5_000,
  importId,
  dryRun,
  useWitsFallback = true,
  officialExcelUrl,
  sheet,
}: Params) {
  const partners = normalizePartnerGeoIds(partnerGeoIds);
  const { ftaExcelUrl } = await resolveCnPreferentialDutySourceUrls({
    ftaExcelUrl: officialExcelUrl,
  });

  let officialRows: DutyRateInsert[] = [];
  let officialError: unknown = null;

  if (ftaExcelUrl) {
    try {
      officialRows = await fetchCnPreferentialDutyRates({
        urlOrPath: ftaExcelUrl,
        sheet,
        hs6List,
        partnerGeoIds: partners,
      });
    } catch (error) {
      officialError = error;
    }
  }

  if (!useWitsFallback && !ftaExcelUrl) {
    throw new Error(
      '[CN Duties] Preferential official source URL is not configured (set source_registry duties.cn.official.fta_excel or CN_FTA_OFFICIAL_EXCEL_URL).'
    );
  }

  let witsRows: DutyRateInsert[] = [];
  if (useWitsFallback) {
    const officialPartners = new Set(officialRows.map((row) => row.partner).filter(Boolean));
    const missingPartners = partners.filter((partner) => !officialPartners.has(partner));
    if (missingPartners.length > 0) {
      witsRows = await fetchCnPreferentialFromWits(missingPartners, hs6List);
    }
  }

  const merged = [...officialRows, ...witsRows];
  if (merged.length === 0) {
    const officialErrMsg =
      officialError instanceof Error ? ` Official error: ${officialError.message}` : '';
    if (useWitsFallback) {
      throw new Error(
        `[CN Duties] Preferential produced 0 rows from official and WITS sources.${officialErrMsg}`
      );
    }
    throw new Error(
      `[CN Duties] Preferential produced 0 rows from official source.${officialErrMsg}`
    );
  }

  const res = await batchUpsertDutyRatesFromStream(merged, {
    batchSize,
    importId,
    dryRun,
    makeSourceRef: (r) =>
      [
        r.source === 'wits' ? 'wits' : 'cn-official',
        'CN',
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
