import { batchUpsertSurchargesFromStream } from '../../utils/batch-upsert.js';
import type { SurchargeInsert } from '@clearcost/types';
import { httpFetch } from '../../../../lib/http.js';

const APHIS_FEES_URL = 'https://www.aphis.usda.gov/aphis/resources/fees';
const APHIS_FY25_URL = 'https://www.aphis.usda.gov/aphis/newsroom/stakeholder-info/aqi-fee-2025';
const DEBUG = process.argv.includes('--debug') || process.env.DEBUG === '1';

const $ = (s: string) => s.replace(/\s+/g, ' ').trim();
const numStr = (n: number | null | undefined): string | null =>
  typeof n === 'number' && Number.isFinite(n) ? String(n) : null;

/** Parse a currency like "$123.45" → "123.45" (string) */
const toUSD = (s: string): string | null => numStr(Number(s.replace(/[^\d.]+/g, '')));

// Fiscal year start (e.g., FY2025 => 2024-10-01Z)
function fyStart(fy: number): Date {
  return new Date(Date.UTC(fy - 1, 9, 1));
}

// Current FY (US federal: Oct–Sep)
function currentFY(d = new Date()): number {
  const y = d.getUTCFullYear();
  return d.getUTCMonth() >= 9 ? y + 1 : y;
}

async function fetchText(url: string) {
  const r = await httpFetch(url, { headers: { 'user-agent': 'clearcost-importer' } });
  if (!r.ok) throw new Error(`APHIS fetch ${url} -> ${r.status}`);
  return await r.text();
}

/**
 * Very targeted extraction against APHIS public pages.
 * We probe the main fees page first; if patterns are missing, we try FY25 explainer.
 */
async function scrapeAphis(): Promise<{
  vessel?: { amt: string | null; url: string } | null;
  aircraft?: { amt: string | null; url: string } | null;
  railcar?: { amt: string | null; url: string } | null;
  truckSingle?: { amt: string | null; url: string } | null;
  truckTransponder?: { amt: string | null; url: string } | null;
  barge?: { amt: string | null; url: string } | null;
}> {
  const out: any = {};
  const pages = [APHIS_FEES_URL, APHIS_FY25_URL];

  for (const url of pages) {
    try {
      const html = await fetchText(url);
      const H = $(html);

      if (out.vessel == null) {
        const m = H.match(/Commercial\s+Vessel[^$]*\$\s*([\d,]+(?:\.\d+)?)/i);
        if (m) out.vessel = { amt: toUSD(m[1]!), url };
      }
      if (out.aircraft == null) {
        const m = H.match(/Commercial\s+Aircraft[^$]*\$\s*([\d,]+(?:\.\d+)?)/i);
        if (m) out.aircraft = { amt: toUSD(m[1]!), url };
      }
      if (out.railcar == null) {
        const m = H.match(/Commercial\s+Railcar[^$]*\$\s*([\d,]+(?:\.\d+)?)/i);
        if (m) out.railcar = { amt: toUSD(m[1]!), url };
      }
      if (out.truckSingle == null) {
        const m = H.match(/Commercial\s+Truck[^$]*Single[^$]*\$\s*([\d,]+(?:\.\d+)?)/i);
        if (m) out.truckSingle = { amt: toUSD(m[1]!), url };
      }
      if (out.truckTransponder == null) {
        const m = H.match(/Commercial\s+Truck[^$]*Transponder[^$]*\$\s*([\d,]+(?:\.\d+)?)/i);
        if (m) out.truckTransponder = { amt: toUSD(m[1]!), url };
      }
      if (out.barge == null) {
        const m = H.match(/\bBarge\b[^$]*\$\s*([\d,]+(?:\.\d+)?)/i);
        if (m) out.barge = { amt: toUSD(m[1]!), url };
      }
    } catch (e) {
      if (DEBUG) console.warn('[APHIS] scrape failed', url, (e as Error).message);
    }
  }

  return out;
}

/**
 * Imports APHIS AQI user fees as surcharges with codes:
 *  - AQI_VESSEL, AQI_AIRCRAFT, AQI_RAILCAR, AQI_TRUCK_SINGLE, AQI_TRUCK_TRANSPONDER, AQI_BARGE
 *
 * NOTE: These are generally carrier/arrival fees. We store them so your calculator
 * can optionally include them (e.g., a toggle), not because they apply to every entry line.
 */
export async function importAphisAqiSurcharges(
  opts: {
    fiscalYear?: number;
    effectiveFrom?: Date;
    batchSize?: number;
    importId?: string; // provenance run id (optional)
  } = {}
) {
  const fy = opts.fiscalYear ?? currentFY();
  const effectiveFrom = opts.effectiveFrom ?? fyStart(fy);

  const fees = await scrapeAphis();

  const rows: SurchargeInsert[] = [];
  const push = (
    code:
      | 'AQI_VESSEL'
      | 'AQI_AIRCRAFT'
      | 'AQI_RAILCAR'
      | 'AQI_TRUCK_SINGLE'
      | 'AQI_TRUCK_TRANSPONDER'
      | 'AQI_BARGE',
    amtEntry: { amt: string | null; url: string } | null | undefined,
    transportMode: SurchargeInsert['transportMode'],
    unitCode: SurchargeInsert['unitCode'],
    label: string
  ) => {
    if (!amtEntry || amtEntry.amt == null) return;
    rows.push({
      dest: 'US',
      origin: null,
      hs6: null,
      surchargeCode: code,
      rateType: 'fixed',
      applyLevel: 'arrival',
      valueBasis: 'other',
      transportMode,
      currency: 'USD',
      fixedAmt: null,
      pctAmt: null,
      minAmt: null,
      maxAmt: null,
      unitAmt: amtEntry.amt, // string
      unitCode,
      sourceUrl: amtEntry.url,
      sourceRef: 'APHIS AQI fees',
      notes: `${label} (FY${fy}). Source: APHIS`,
      effectiveFrom,
      effectiveTo: null,
    });
  };

  // Map each fee → mode/unit
  push('AQI_VESSEL', fees.vessel, 'OCEAN', 'ARRIVAL', 'APHIS AQI Commercial Vessel user fee');
  push('AQI_AIRCRAFT', fees.aircraft, 'AIR', 'ARRIVAL', 'APHIS AQI Commercial Aircraft user fee');
  push(
    'AQI_RAILCAR',
    fees.railcar,
    'RAIL',
    'CAR',
    'APHIS AQI Commercial Railcar user fee (per car)'
  );
  push(
    'AQI_TRUCK_SINGLE',
    fees.truckSingle,
    'TRUCK',
    'ARRIVAL',
    'APHIS AQI Commercial Truck arrival fee (single crossing)'
  );
  push(
    'AQI_TRUCK_TRANSPONDER',
    fees.truckTransponder,
    'TRUCK',
    'ANNUAL',
    'APHIS AQI Commercial Truck annual transponder'
  );
  push('AQI_BARGE', fees.barge, 'OCEAN', 'BARGE', 'APHIS AQI Barge user fee (per barge)');

  if (!rows.length) {
    throw new Error(
      '[APHIS AQI] produced 0 rows. Check APHIS source availability and scraping patterns.'
    );
  }

  const ret = await batchUpsertSurchargesFromStream(rows, {
    batchSize: opts.batchSize ?? 500,
    importId: opts.importId,
    makeSourceRef: (r) => {
      const ef =
        r.effectiveFrom instanceof Date
          ? r.effectiveFrom.toISOString().slice(0, 10)
          : String(r.effectiveFrom ?? '');
      return `aphis:aqi:${r.surchargeCode.toLowerCase()}:fy=${fy}:ef=${ef}`;
    },
  });

  return { ok: true as const, count: ret.count ?? ret.inserted ?? rows.length };
}
