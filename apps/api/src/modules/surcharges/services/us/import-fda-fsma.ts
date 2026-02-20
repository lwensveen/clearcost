import { batchUpsertSurchargesFromStream } from '../../utils/batch-upsert.js';
import type { SurchargeInsert } from '@clearcost/types';
import { httpFetch } from '../../../../lib/http.js';
import { resolveUsSurchargeSourceUrls } from './source-urls.js';

const FDA_VQIP_SOURCE_KEY = 'surcharges.us.fda.vqip_fees';
const FR_SEARCH_SOURCE_KEY = 'surcharges.us.federal_register.search';

const DEBUG = process.argv.includes('--debug') || process.env.DEBUG === '1';

const $ = (s: string) => s.replace(/\s+/g, ' ').trim();
// Return STRING (for Drizzle numeric) or null
const toUSDstr = (s: string): string | null => {
  const n = Number(s.replace(/[^\d.]+/g, ''));
  return Number.isFinite(n) ? String(n) : null;
};

// US FY start (FY n starts Oct 1 of n-1)
function fyStart(fy: number): Date {
  return new Date(Date.UTC(fy - 1, 9, 1));
}
function currentFY(d = new Date()): number {
  const y = d.getUTCFullYear();
  return d.getUTCMonth() >= 9 ? y + 1 : y;
}

async function fetchText(url: string) {
  const r = await httpFetch(url, { headers: { 'user-agent': 'clearcost-importer' } });
  if (!r.ok) throw new Error(`FDA/FR fetch ${url} -> ${r.status}`);
  return await r.text();
}

function fsmaSearchUrl(searchBaseUrl: string, fy: number): string {
  const url = new URL(searchBaseUrl);
  url.searchParams.set('term', `Food Safety Modernization Act fee rates fiscal year ${fy}`);
  return url.toString();
}

/** Parse VQIP fees (user + application) from FDA page. */
async function scrapeVQIP(vqipUrl: string): Promise<{
  userFee?: string | null;
  appFee?: string | null;
  fy?: number | null;
  url?: string;
}> {
  try {
    const html = await fetchText(vqipUrl);
    const H = $(html);

    // “Fee rates for fiscal year (FY) 20XX”
    const fyM = H.match(/Fee rates for fiscal year\s*\(FY\)\s*(20\d{2})/i);
    const fy = fyM ? Number(fyM[1]) : null;

    // “VQIP user fee $18,328” / “Application fee $441”
    const userM = H.match(/VQIP\s+user\s+fee[^$]*\$\s*([\d,]+(?:\.\d+)?)/i);
    const appM = H.match(/Application\s+fee[^$]*\$\s*([\d,]+(?:\.\d+)?)/i);

    return {
      fy,
      userFee: userM ? toUSDstr(userM[1]!) : null,
      appFee: appM ? toUSDstr(appM[1]!) : null,
      url: vqipUrl,
    };
  } catch (e) {
    if (DEBUG) console.warn('[FDA] VQIP scrape failed', (e as Error).message);
    return {};
  }
}

/** Parse FSMA Reinspection hourly rates (domestic/foreign) from Federal Register search. */
async function scrapeFsmaReinspection(
  searchBaseUrl: string,
  fy: number
): Promise<{
  domestic?: string | null;
  foreign?: string | null;
  fy?: number;
  src?: string | null;
}> {
  const candidates: string[] = [
    fsmaSearchUrl(searchBaseUrl, fy),
    fsmaSearchUrl(searchBaseUrl, fy - 1),
  ];

  for (const url of candidates) {
    try {
      const html = await fetchText(url);
      const H = $(html);
      const m = H.match(
        /hourly\s+rate\s+of\s+\$([\d,.]+)\s+for\s+a\s+domestic\s+facility\s+and\s+\$([\d,.]+)\s+for\s+a\s+foreign\s+facility/i
      );
      if (m) {
        return {
          domestic: toUSDstr(m[1]!),
          foreign: toUSDstr(m[2]!),
          fy,
          src: url,
        };
      }
    } catch (e) {
      if (DEBUG) console.warn('[FDA] FSMA probe failed', url, (e as Error).message);
    }
  }
  return {};
}

/**
 * Import FDA FSMA-related surcharges:
 *  - VQIP annual user fee + application fee (program-level, annual/application units)
 *  - FSMA reinspection hourly rates (program-level, per-hour unit)
 */
export async function importFdaFsmaSurcharges(
  opts: { fiscalYear?: number; effectiveFrom?: Date; batchSize?: number; importId?: string } = {}
) {
  const { fdaVqipUrl, federalRegisterSearchBaseUrl } = await resolveUsSurchargeSourceUrls();

  // 1) VQIP (authoritative FDA page)
  const vqip = await scrapeVQIP(fdaVqipUrl);
  const fyFromVqip = vqip.fy ?? currentFY();
  const effectiveFrom = opts.effectiveFrom ?? fyStart(fyFromVqip);

  // 2) FSMA reinspection (FR search)
  const fy = opts.fiscalYear ?? fyFromVqip ?? currentFY();
  const fsma = await scrapeFsmaReinspection(federalRegisterSearchBaseUrl, fy);

  const rows: SurchargeInsert[] = [];
  const base: Omit<
    SurchargeInsert,
    'surchargeCode' | 'sourceUrl' | 'sourceRef' | 'notes' | 'effectiveFrom' | 'effectiveTo'
  > & { effectiveFrom: Date; effectiveTo: Date | null } = {
    dest: 'US',
    origin: null,
    hs6: null,
    rateType: 'fixed',
    applyLevel: 'program',
    valueBasis: 'other',
    transportMode: 'ALL',
    currency: 'USD',
    fixedAmt: null,
    pctAmt: null,
    minAmt: null,
    maxAmt: null,
    unitAmt: null,
    unitCode: null,
    effectiveFrom,
    effectiveTo: null,
  };

  // VQIP annual user fee
  if (vqip.userFee != null) {
    rows.push({
      ...base,
      surchargeCode: 'FDA_VQIP_USER_FEE_ANNUAL',
      unitAmt: vqip.userFee,
      unitCode: 'ANNUAL',
      sourceUrl: vqip.url ?? null,
      sourceRef: 'FDA VQIP fees',
      notes: `FDA VQIP annual user fee (FY${fyFromVqip}).`,
    });
  }

  // VQIP application fee
  if (vqip.appFee != null) {
    rows.push({
      ...base,
      surchargeCode: 'FDA_VQIP_APPLICATION_FEE',
      unitAmt: vqip.appFee,
      unitCode: 'APPLICATION',
      sourceUrl: vqip.url ?? null,
      sourceRef: 'FDA VQIP fees',
      notes: `FDA VQIP application fee (FY${fyFromVqip}).`,
    });
  }

  // FSMA reinspection hourly (domestic)
  if (fsma.domestic != null) {
    rows.push({
      ...base,
      surchargeCode: 'FDA_FSMA_REINSPECTION_HOURLY_DOM',
      unitAmt: fsma.domestic,
      unitCode: 'HOUR',
      sourceUrl: fsma.src ?? null,
      sourceRef: 'FSMA fee rates (FR search)',
      notes: `FSMA domestic facility reinspection hourly rate (FY${fy}).`,
    });
  }

  // FSMA reinspection hourly (foreign)
  if (fsma.foreign != null) {
    rows.push({
      ...base,
      surchargeCode: 'FDA_FSMA_REINSPECTION_HOURLY_FOR',
      unitAmt: fsma.foreign,
      unitCode: 'HOUR',
      sourceUrl: fsma.src ?? null,
      sourceRef: 'FSMA fee rates (FR search)',
      notes: `FSMA foreign facility reinspection hourly rate (FY${fy}).`,
    });
  }

  if (!rows.length) {
    throw new Error(
      '[FDA FSMA] produced 0 rows. Check FDA/Federal Register source availability and scraping patterns.'
    );
  }

  const ret = await batchUpsertSurchargesFromStream(rows, {
    batchSize: opts.batchSize ?? 500,
    importId: opts.importId,
    sourceKey: (r) => {
      switch (r.surchargeCode) {
        case 'FDA_VQIP_USER_FEE_ANNUAL':
        case 'FDA_VQIP_APPLICATION_FEE':
          return FDA_VQIP_SOURCE_KEY;
        case 'FDA_FSMA_REINSPECTION_HOURLY_DOM':
        case 'FDA_FSMA_REINSPECTION_HOURLY_FOR':
          return FR_SEARCH_SOURCE_KEY;
        default:
          return null;
      }
    },
    makeSourceRef: (r) => {
      const ef =
        r.effectiveFrom instanceof Date
          ? r.effectiveFrom.toISOString().slice(0, 10)
          : String(r.effectiveFrom).slice(0, 10);
      switch (r.surchargeCode) {
        case 'FDA_VQIP_USER_FEE_ANNUAL':
          return `fda:vqip:user_fee:fy=${fyFromVqip}:ef=${ef}`;
        case 'FDA_VQIP_APPLICATION_FEE':
          return `fda:vqip:application_fee:fy=${fyFromVqip}:ef=${ef}`;
        case 'FDA_FSMA_REINSPECTION_HOURLY_DOM':
          return `fda:fsma:reinspection:dom:fy=${fy}:ef=${ef}`;
        case 'FDA_FSMA_REINSPECTION_HOURLY_FOR':
          return `fda:fsma:reinspection:for:fy=${fy}:ef=${ef}`;
        default:
          return undefined;
      }
    },
  });

  return { ok: true as const, count: ret.count ?? ret.inserted ?? rows.length };
}
