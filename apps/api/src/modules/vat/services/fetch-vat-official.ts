// modules/vat/services/fetch-vat-official.ts
//
// PURPOSE
// -------
// Fetch authoritative, machine-readable VAT/GST rate data from public sources,
// parse the files, normalize to Clearcost DB insert types, and return rows
// ready for import. We currently support multiple “kinds” of rates per country:
//   - STANDARD
//   - REDUCED
//   - SUPER_REDUCED
//   - ZERO (zero-rated = 0%)
// Data sources:
//   1) OECD (primary / preferred)
//   2) IMF  (secondary / fill-only)
//
// DESIGN NOTES
// ------------
// • Prefer OECD values; fill only missing (dest, kind) with IMF values.
// • Rates are normalized to NUMERIC(6,3) strings ("21.000") for DB inserts.
// • Country names are mapped to ISO-3166-1 alpha-2 codes using
//   i18n-iso-countries (with a small alias table for common name variants).
// • Effective dates are set to “today” (UTC) as a pragmatic default; these can
//   be enhanced later by parsing metadata or publication dates from the sources.
// • Import VAT base defaults to CIF_PLUS_DUTY; override later per-country
//   or per-HS rule as you collect more granular data.
//
// EXTENSION POINTS
// ----------------
// • Add an EU Commission parser (PDF/XLSX) and prefer EC for EU members.
// • Pull reduced/super-reduced/zero for more countries as availability allows.
// • Attach provenance details (file URL, sheet name, hash) if you want deeper audits.

import { read as readXlsx, utils as xlsxUtils } from 'xlsx';
import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json' with { type: 'json' };
import type { VatRuleInsert } from '@clearcost/types';
import { fetchArrayBuffer, parseRateCell, todayISO, toIso2, toNumeric3String } from './utils.js';

countries.registerLocale(en);

type VatRateKind = 'STANDARD' | 'REDUCED' | 'SUPER_REDUCED' | 'ZERO';
type SourceId = 'oecd' | 'imf';

const DEFAULT_BASE: VatRuleInsert['base'] = 'CIF_PLUS_DUTY';
const MAX_REASONABLE_RATE_PCT = 60;

const OECD_XLSX_URL =
  'https://www.oecd.org/content/dam/oecd/en/topics/policy-sub-issues/consumption-tax-trends/vat-gst-rates-ctt-trends.xlsx';

const IMF_XLSX_URL = 'https://www.imf.org/external/np/fad/tpaf/files/vat_substandard_rates.xlsx';

const NAME_ALIASES: Record<string, string> = {
  'viet nam': 'Vietnam',
  'brunei darussalam': 'Brunei',
  'lao pdr': 'Laos',
  'korea, republic of': 'South Korea',
  'myanmar (burma)': 'Myanmar',
  'côte d’ivoire': "Cote d'Ivoire",
};

/** 🔧 NEW: skip places without VAT/GST so we don’t generate spurious rows */
const SKIP_ISO2 = new Set<string>([
  'BN', // Brunei — no VAT (GST repealed)
  // add more if you want to exclude SST-only jurisdictions, etc.
]);

type RowRates = {
  dest: string; // ISO-2
  standard?: number | null;
  reduced?: number | null;
  superReduced?: number | null;
  zero?: number | null; // 0 or null (present means zero-rated is applicable)
};

/**
 * Extract country + rate columns from a worksheet using header heuristics.
 * We search for known header substrings (case-insensitive) so column order/names
 * can drift without breaking the importer.
 */
function extractRows(
  sheet: any,
  hints: { countryKeys: string[]; map: Record<VatRateKind, string[]> }
): RowRates[] {
  // `raw:false` → xlsx parses strings for us (we still sanitize)
  const json = xlsxUtils.sheet_to_json<Record<string, any>>(sheet, { raw: false, defval: null });
  const out: RowRates[] = [];

  const findHeader = (obj: any, keys: string[]) =>
    keys.find((k) => Object.keys(obj).some((h) => h.toLowerCase().includes(k.toLowerCase())));

  for (const row of json) {
    if (!row || typeof row !== 'object') continue;

    const countryHdr = findHeader(row, hints.countryKeys);
    if (!countryHdr) continue;

    const rawName = String(row[countryHdr] ?? '').trim();
    const alias = NAME_ALIASES[rawName.toLowerCase()];
    const normName = alias ?? rawName;

    const dest = toIso2(normName);
    if (!dest || SKIP_ISO2.has(dest)) continue;

    const pick = (cands: string[]) => {
      const hdr = findHeader(row, cands);
      return hdr ? parseRateCell(row[hdr]) : null;
    };

    out.push({
      dest,
      standard: pick(hints.map.STANDARD),
      reduced: pick(hints.map.REDUCED),
      superReduced: pick(hints.map.SUPER_REDUCED),
      zero: pick(hints.map.ZERO),
    });
  }

  return out;
}

/**
 * OECD workbook parsing:
 * - Looks for a sheet with recognizable country/rate headers.
 * - Returns an array of RowRates (one entry per country).
 */
function parseOecd(workbook: ReturnType<typeof readXlsx>): RowRates[] {
  const hints = {
    countryKeys: ['country', 'jurisdiction'],
    map: {
      STANDARD: ['standard', 'vat/gst (standard)', 'vat (standard)', 'gst (standard)'],
      REDUCED: ['reduced', 'reduced rates', 'vat/gst (reduced)'],
      SUPER_REDUCED: ['super-reduced', 'super reduced'],
      ZERO: ['zero', 'zero rate'],
    } as Record<VatRateKind, string[]>,
  };

  for (const sheetName of workbook.SheetNames) {
    const rows = extractRows(workbook.Sheets[sheetName], hints);
    if (rows.length >= 10) return rows; // quick sanity threshold
  }
  return [];
}

/**
 * IMF workbook parsing:
 * - Similar heuristics to OECD, with slightly different header candidates.
 */
function parseImf(workbook: ReturnType<typeof readXlsx>): RowRates[] {
  const hints = {
    countryKeys: ['country'],
    map: {
      STANDARD: ['standard', 'vat standard', 'vat/gst (standard)'],
      REDUCED: ['reduced', 'reduced rates'],
      SUPER_REDUCED: ['super-reduced', 'super reduced'],
      ZERO: ['zero', 'zero rate'],
    } as Record<VatRateKind, string[]>,
  };

  for (const sheetName of workbook.SheetNames) {
    const rows = extractRows(workbook.Sheets[sheetName], hints);
    if (rows.length >= 10) return rows;
  }
  return [];
}

/**
 * Merge two RowRates lists with “prefer OECD” policy per (dest, kind).
 * IMF data is only used to fill missing (dest, kind) combinations.
 */
function mergePreferOecd(oecd: RowRates[], imf: RowRates[]) {
  type Key = `${string}:${VatRateKind}`;
  const acc = new Map<Key, { dest: string; kind: VatRateKind; rate: number; source: SourceId }>();

  const put = (
    dest: string,
    kind: VatRateKind,
    rate: number | null | undefined,
    source: SourceId
  ) => {
    if (rate == null) return;
    let normalized = rate;
    if (kind === 'ZERO') normalized = 0; // zero-rated is strictly 0%

    if (!Number.isFinite(normalized) || normalized < 0 || normalized > MAX_REASONABLE_RATE_PCT) {
      return; // drop obvious outliers
    }

    const key = `${dest}:${kind}` as Key;
    if (source === 'imf' && acc.has(key)) return; // keep OECD value if present

    acc.set(key, { dest, kind, rate: normalized, source });
  };

  // OECD first
  for (const r of oecd) {
    put(r.dest, 'STANDARD', r.standard, 'oecd');
    put(r.dest, 'REDUCED', r.reduced, 'oecd');
    put(r.dest, 'SUPER_REDUCED', r.superReduced, 'oecd');
    put(r.dest, 'ZERO', r.zero, 'oecd');
  }

  // IMF fill-only
  for (const r of imf) {
    put(r.dest, 'STANDARD', r.standard, 'imf');
    put(r.dest, 'REDUCED', r.reduced, 'imf');
    put(r.dest, 'SUPER_REDUCED', r.superReduced, 'imf');
    put(r.dest, 'ZERO', r.zero, 'imf');
  }

  return [...acc.values()];
}

/**
 * Fetch OECD + IMF, parse, merge, normalize → VatRuleInsert[].
 * Use the returned rows directly with `importVatRules(rows)`.
 */
export async function fetchVatRowsFromOfficialSources(): Promise<VatRuleInsert[]> {
  // Download both workbooks in parallel for speed.
  const [oecdBuf, imfBuf] = await Promise.all([
    fetchArrayBuffer(OECD_XLSX_URL),
    fetchArrayBuffer(IMF_XLSX_URL),
  ]);

  // Parse into workbooks
  const oecdWb = readXlsx(new Uint8Array(oecdBuf), { type: 'array' });
  const imfWb = readXlsx(new Uint8Array(imfBuf), { type: 'array' });

  // Extract structured rows from both sources
  const oecdRows = parseOecd(oecdWb);
  const imfRows = parseImf(imfWb);

  // Merge with prefer-OECD policy
  const merged = mergePreferOecd(oecdRows, imfRows);

  const stableKey = (r: { dest: string; kind: VatRateKind; rate: number }) =>
    `${r.dest}:${r.kind}:${r.rate}`;
  const dedup = new Map<
    string,
    { dest: string; kind: VatRateKind; rate: number; source: SourceId }
  >();
  for (const r of merged) dedup.set(stableKey(r), r);
  const stable = [...dedup.values()];

  // Effective dates: today (UTC) as pragmatic default.
  const today = todayISO();

  // Normalize to DB insert rows (VatRuleInsert)
  return stable.map(({ dest, kind, rate, source }) => ({
    dest,
    kind,
    ratePct: toNumeric3String(rate),
    base: DEFAULT_BASE,
    effectiveFrom: new Date(today),
    effectiveTo: null,
    notes:
      source === 'oecd'
        ? 'source: OECD Consumption Tax Trends (standard/reduced/super-reduced/zero)'
        : 'source: IMF VAT rates (TPAF)',
  }));
}
