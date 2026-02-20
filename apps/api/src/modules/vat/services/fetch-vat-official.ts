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

import { read as readXlsx, utils as xlsxUtils } from 'xlsx';
import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json' with { type: 'json' };
import type { VatRuleInsert } from '@clearcost/types';
import { resolveSourceDownloadUrl } from '../../../lib/source-registry.js';
import { fetchArrayBuffer, parseRateCell, todayISO, toIso2, toNumeric3String } from './utils.js';

countries.registerLocale(en);

type VatRateKind = 'STANDARD' | 'REDUCED' | 'SUPER_REDUCED' | 'ZERO';
type SourceId = 'oecd' | 'imf';

const DEFAULT_BASE: VatRuleInsert['vatBase'] = 'CIF_PLUS_DUTY';
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

const SKIP_ISO2 = new Set<string>([
  'BN', // Brunei — GST repealed
]);

type RowRates = {
  dest: string;
  standard?: number | null;
  reduced?: number | null;
  superReduced?: number | null;
  zero?: number | null;
};

// ----------------------------- helpers ---------------------------------

const norm = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isYearStrict = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1970 && n <= 2100;
};

const extractYearLoose = (v: unknown): number | null => {
  if (v == null) return null;
  if (isYearStrict(v)) return Number(v);
  const m = String(v).match(/\b(19|20)\d{2}\b/);
  return m ? Number(m[0]) : null;
};

function toPercent(n: number | null): number | null {
  if (n == null) return null;
  if (n > 0 && n <= 1.5) return n * 100; // decimals → percent (0.2 => 20)
  return n;
}

function clampRate(n: number | null): number | null {
  if (n == null) return null;
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > MAX_REASONABLE_RATE_PCT) return null;
  return n;
}

function cellText(v: unknown) {
  return String(v ?? '').trim();
}

function hasZeroIndication(text: string) {
  return /(^|[^\d])0([\.,]0+)?(%|\b)/.test(text);
}

// ----------------------------- OECD ------------------------------------
//
// Strategy:
// A) Try to detect a country column by ISO-2 hits (no header required).
// B) Try to detect a “standard” column by scoring columns whose header looks like a year
//    and where many rows parse as rates. Prefer the RIGHTMOST viable candidate.
// C) If (B) fails, do a row-level fallback: for each country row, take the RIGHTMOST
//    numeric-looking cell as the latest standard rate.
// D) Try to locate a “reduced” column by scanning the top ~20 rows for any cell containing “reduced”.
//

function parseOecd(workbook: ReturnType<typeof readXlsx>, debug = false): RowRates[] {
  if (debug) console.log('VAT: probing OECD sheets...');

  let best: { sheet: string; rows: RowRates[] } | null = null;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue; // TS: guard undefined worksheets

    const A = xlsxUtils.sheet_to_json<any[]>(sheet, {
      header: 1,
      raw: false,
      defval: null,
    }) as any[][];

    if (!A.length) continue;

    const maxRows = Math.min(A.length, 800);
    const maxCols = A.reduce((m, r) => Math.max(m, r?.length ?? 0), 0);

    // A) country column via ISO-2 hits
    let countryCol = -1;
    let countryHits = 0;
    for (let c = 0; c < maxCols; c++) {
      let hits = 0;
      for (let r = 0; r < maxRows; r++) {
        const raw = String(A[r]?.[c] ?? '').trim();
        if (!raw) continue;
        const alias = NAME_ALIASES[raw.toLowerCase()];
        const iso2 = toIso2(alias ?? raw);
        if (iso2 && !SKIP_ISO2.has(iso2)) hits++;
      }
      if (hits > countryHits) {
        countryHits = hits;
        countryCol = c;
      }
    }

    // B) score “standard” candidates (column-based)
    type Score = {
      col: number;
      score: number;
      header: string;
      pureYear: boolean;
      hasTemporary: boolean;
    };
    const candidates: Score[] = [];
    if (countryCol >= 0) {
      for (let c = 0; c < maxCols; c++) {
        if (c === countryCol) continue;
        let good = 0;
        let seen = 0;
        for (let r = 0; r < maxRows; r++) {
          const rawName = String(A[r]?.[countryCol] ?? '').trim();
          if (!rawName) continue;
          const alias = NAME_ALIASES[rawName.toLowerCase()];
          const iso2 = toIso2(alias ?? rawName);
          if (!iso2 || SKIP_ISO2.has(iso2)) continue;

          seen++;
          const val = parseRateCell(A[r]?.[c]);
          const clamped = clampRate(toPercent(val));
          if (clamped != null) good++;
        }
        if (seen >= 10) {
          const headerish = [A[0]?.[c], A[1]?.[c], A[2]?.[c], A[3]?.[c]].find((x) => x != null);
          const headerText = String(headerish ?? '');
          const pureYear = /^\s*\d{4}\s*$/.test(headerText);
          const hasTemporary = /temporary/i.test(headerText);
          const score = good / seen;
          if (score >= 0.25) {
            candidates.push({ col: c, score, header: headerText, pureYear, hasTemporary });
          }
        }
      }
    }

    // Choose standard column:
    // 1) prefer pure 4-digit year headers
    // 2) prefer higher score
    // 3) penalize "temporary"
    // 4) break ties by rightmost column
    let stdCol = -1;
    if (candidates.length) {
      const ranked = candidates.map((c) => {
        const penalty = c.hasTemporary ? 0.5 : 0;
        const bonus = c.pureYear ? 0.5 : 0; // nudge pure years ahead
        return { ...c, rank: c.score + bonus - penalty };
      });
      ranked.sort((a, b) => (a.rank === b.rank ? a.col - b.col : a.rank - b.rank));
      stdCol = ranked[ranked.length - 1]!.col;
    }

    // C) “reduced” column detection — avoid "temporary"
    let redCol = -1;
    const scanRows = Math.min(20, A.length);
    type RedCand = { col: number; pref: number; text: string };
    const reds: RedCand[] = [];
    for (let r = 0; r < scanRows; r++) {
      for (let c = 0; c < maxCols; c++) {
        const v = norm(A[r]?.[c]);
        if (!v.includes('reduc')) continue;
        // preference: exact "reduced rates" > contains "reduced" (generic) > contains "temporary"
        const pref = v === 'reduced rates' ? 3 : v.includes('temporary') ? 1 : 2;
        reds.push({ col: c, pref, text: v });
      }
    }
    if (reds.length) {
      reds.sort((a, b) => (a.pref === b.pref ? a.col - b.col : a.pref - b.pref));
      redCol = reds[reds.length - 1]!.col;
    }

    if (debug) {
      const tail = candidates
        .slice()
        .sort((a, b) => a.col - b.col)
        .map((x) => ({
          col: x.col,
          score: Number(x.score.toFixed(2)),
          pureYear: x.pureYear,
          header: x.header,
        }))
        .slice(-12);
      console.log('VAT: OECD detection ->', {
        countryCol,
        countryHits,
        stdCol,
        redCol,
        sampleCandidatesTail: tail,
      });
    }

    // D) build rows (with fallback if stdCol not found)
    const rows: RowRates[] = [];
    if (countryCol >= 0) {
      for (let r = 0; r < A.length; r++) {
        const rawName = String(A[r]?.[countryCol] ?? '').trim();
        if (!rawName) continue;
        const alias = NAME_ALIASES[rawName.toLowerCase()];
        const dest = toIso2(alias ?? rawName);
        if (!dest || SKIP_ISO2.has(dest)) continue;

        let std: number | null = null;
        let reduced: number | null = null;
        let zero: number | null = null;

        if (stdCol >= 0) {
          std = clampRate(toPercent(parseRateCell(A[r]?.[stdCol])));
        } else {
          // row-level fallback: pick rightmost numeric-looking cell
          for (let c = maxCols - 1; c >= 0; c--) {
            if (c === countryCol) continue;
            const v = parseRateCell(A[r]?.[c]);
            const val = clampRate(toPercent(v));
            if (val != null) {
              std = val;
              break;
            }
          }
        }

        if (redCol >= 0) {
          const rr = parseRateCell(A[r]?.[redCol]);
          reduced = clampRate(toPercent(rr));
          if (hasZeroIndication(String(A[r]?.[redCol] ?? ''))) zero = 0;
        }

        if (std != null || reduced != null || zero != null) {
          rows.push({ dest, standard: std, reduced, superReduced: null, zero });
        }
      }
    }

    if (debug) {
      console.log(
        `VAT: sheet "${sheetName}" -> ${rows.length} rows (picked: ${JSON.stringify({
          countryCol,
          stdCol,
          redCol,
        })})`
      );
    }

    if (!best || rows.length > best.rows.length) best = { sheet: sheetName, rows };
  }

  if (debug) {
    console.log(
      `VAT: chose sheet "${best ? best.sheet : '<none>'}" with ${best ? best.rows.length : 0} rows`
    );
  }

  return best?.rows ?? [];
}

function parseImf(workbook: ReturnType<typeof readXlsx>, debug = false): RowRates[] {
  if (debug) console.log('VAT: probing IMF sheets...');

  let best: { sheet: string; rows: RowRates[] } | null = null;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue; // TS: guard undefined worksheets

    const A = xlsxUtils.sheet_to_json<any[]>(sheet, {
      header: 1,
      raw: false,
      defval: null,
    }) as any[][];

    if (!A.length) continue;

    // Find the row whose first col is "Countries"
    let countriesRow = -1;
    for (let r = 0; r < Math.min(A.length, 50); r++) {
      if (norm(A[r]?.[0]) === 'countries') {
        countriesRow = r;
        break;
      }
    }
    if (countriesRow < 0) continue;

    const hdr = A[countriesRow + 1] ?? [];
    const findCol = (needle: string) => {
      const target = norm(needle);
      for (let c = 0; c < hdr.length; c++) {
        const h = norm(hdr[c]);
        if (h.includes(target)) return c;
      }
      return -1;
    };

    const colCountry = 0;
    const colStd = findCol('vat/gst (standard)');
    const colRed = findCol('vat/gst (reduced)');

    if (debug) {
      console.log('VAT: header probe ->', {
        headerRow: countriesRow + 1,
        colCountry,
        colStd: colStd >= 0 ? colStd : null,
        colRed: colRed >= 0 ? colRed : null,
        colSup: null,
        colZero: null,
      });
    }

    const rows: RowRates[] = [];
    for (let r = countriesRow + 2; r < A.length; r++) {
      const row = A[r];
      if (!row) continue;

      const rawName = cellText(row[colCountry]);
      if (!rawName) continue;

      const alias = NAME_ALIASES[rawName.toLowerCase()];
      const normName = alias ?? rawName;

      const dest = toIso2(normName);
      if (!dest || SKIP_ISO2.has(dest)) continue;

      const stdRaw = colStd >= 0 ? parseRateCell(row[colStd]) : null;
      const std = clampRate(toPercent(stdRaw));

      let reduced: number | null = null;
      let zero: number | null = null;
      if (colRed >= 0) {
        const rr = parseRateCell(row[colRed]);
        reduced = clampRate(toPercent(rr));
        const txt = cellText(row[colRed]);
        if (hasZeroIndication(txt)) zero = 0;
      }

      if (std != null || reduced != null || zero != null) {
        rows.push({ dest, standard: std, reduced, superReduced: null, zero });
      }
    }

    if (debug) {
      console.log(
        `VAT: sheet "${sheetName}" -> ${rows.length} rows (picked: ${JSON.stringify({
          headerRow: countriesRow + 1,
          colStd,
          colRed,
        })})`
      );
    }

    if (!best || rows.length > best.rows.length) best = { sheet: sheetName, rows };
  }

  if (debug) {
    console.log(
      `VAT: chose sheet "${best ? best.sheet : '<none>'}" with ${best ? best.rows.length : 0} rows`
    );
  }
  return best?.rows ?? [];
}

function mergePreferOecd(
  oecd: RowRates[],
  imf: RowRates[]
): Array<{ dest: string; kind: VatRateKind; rate: number; source: SourceId }> {
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
    if (kind === 'ZERO') normalized = 0;
    if (!Number.isFinite(normalized) || normalized < 0 || normalized > MAX_REASONABLE_RATE_PCT) {
      return;
    }
    const key = `${dest}:${kind}` as Key;
    if (source === 'imf' && acc.has(key)) return; // prefer OECD
    acc.set(key, { dest, kind, rate: normalized, source });
  };

  for (const r of oecd) {
    put(r.dest, 'STANDARD', r.standard, 'oecd');
    put(r.dest, 'REDUCED', r.reduced, 'oecd');
    put(r.dest, 'SUPER_REDUCED', r.superReduced, 'oecd');
    put(r.dest, 'ZERO', r.zero, 'oecd');
  }
  for (const r of imf) {
    put(r.dest, 'STANDARD', r.standard, 'imf');
    put(r.dest, 'REDUCED', r.reduced, 'imf');
    put(r.dest, 'SUPER_REDUCED', r.superReduced, 'imf');
    put(r.dest, 'ZERO', r.zero, 'imf');
  }
  return [...acc.values()];
}

/**
 * Fetch OECD and/or IMF, parse, merge, normalize → VatRuleInsert[].
 * Use the returned rows directly with `importVatRules(rows)`.
 */
export async function fetchVatRowsFromOfficialSources(opts?: {
  oecd?: boolean;
  imf?: boolean;
  debug?: boolean;
}): Promise<VatRuleInsert[]> {
  const useOecd = opts?.oecd ?? true;
  const useImf = opts?.imf ?? true;
  const DEBUG = !!opts?.debug || !!process.env.VAT_DEBUG;

  if (!useOecd && !useImf) return [];

  // Avoid readonly tuple unions by assigning into mutable arrays
  let oecdRows: RowRates[] = [];
  let imfRows: RowRates[] = [];
  const oecdUrl = useOecd
    ? await resolveSourceDownloadUrl({
        sourceKey: 'vat.oecd_imf.standard',
        fallbackUrl: OECD_XLSX_URL,
      })
    : null;

  if (useOecd && useImf) {
    const [oecdBuf, imfBuf] = await Promise.all([
      fetchArrayBuffer(oecdUrl!),
      fetchArrayBuffer(IMF_XLSX_URL),
    ]);
    const oecdWb = readXlsx(new Uint8Array(oecdBuf), { type: 'array' });
    const imfWb = readXlsx(new Uint8Array(imfBuf), { type: 'array' });
    oecdRows = parseOecd(oecdWb, DEBUG);
    imfRows = parseImf(imfWb, DEBUG);
  } else if (useOecd) {
    const oecdBuf = await fetchArrayBuffer(oecdUrl!);
    const oecdWb = readXlsx(new Uint8Array(oecdBuf), { type: 'array' });
    oecdRows = parseOecd(oecdWb, DEBUG);
  } else if (useImf) {
    const imfBuf = await fetchArrayBuffer(IMF_XLSX_URL);
    const imfWb = readXlsx(new Uint8Array(imfBuf), { type: 'array' });
    imfRows = parseImf(imfWb, DEBUG);
  }

  // Always normalize to {dest, kind, rate, source}[]
  const merged = mergePreferOecd(useOecd ? oecdRows : [], useImf ? imfRows : []);

  // Deduplicate by (dest, kind, rate)
  const stableKey = (r: { dest: string; kind: VatRateKind; rate: number }) =>
    `${r.dest}:${r.kind}:${r.rate}`;
  const dedup = new Map<
    string,
    { dest: string; kind: VatRateKind; rate: number; source: SourceId }
  >();
  for (const r of merged) dedup.set(stableKey(r), r);
  const stable = [...dedup.values()];

  if (DEBUG) {
    const srcCount = stable.reduce(
      (acc, r) => ((acc[r.source] = (acc[r.source] ?? 0) + 1), acc),
      {} as Record<string, number>
    );
    console.log(`VAT: normalized rows = ${stable.length} (by source: ${JSON.stringify(srcCount)})`);
  }

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
        ? 'importSource: OECD Consumption Tax Trends (standard/reduced/super-reduced/zero)'
        : 'importSource: IMF VAT rates (TPAF)',
  }));
}
