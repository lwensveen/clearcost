// services/us/import-us-trade-remedies.ts
// Import US trade-remedy surcharges (Section 301/232) from USITC HTS JSON (Chapter 99).
// v1 scope:
//   • 301 (China):       9903.88.xx → origin='CN'
//   • 232 (steel/alum.): 9903.80.xx / 9903.85.xx → origin=null (country carve-outs later)
//   • Ad-valorem % only. Specific/compound noted in `notes`, skipped if no % is found.
// Aggregation rule (fits unique index dest+code+effectiveFrom):
//   → Keep ONE row per code (301, 232), taking the MAX % across all matching 10-digit lines.
//
// Later (v2): parse U.S. Notes (e.g., Note 20) to map coverage into `hs6`, and 232 carve-outs.

import type { SurchargeInsert } from '@clearcost/types';
import { importSurcharges } from '../import-surcharges.js';
import {
  exportChapterJson,
  hasCompound,
  parseHts10,
} from '../../../duty-rates/services/us/hts-base.js';

type ImportOpts = {
  effectiveFrom?: Date; // default: Jan 1 of current UTC year
  skipFree?: boolean; // if true, drop 0% rows
};

function jan1UTCOfCurrentYear(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
}

/** Extract a % from "25%", "10 %", etc. */
function parsePercent(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = /(\d+(?:\.\d+)?)\s*%/.exec(String(text));
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) && v >= 0 ? v : null;
}

/** Column 1 (General) cell — HTS dumps vary; try common keys. */
function getGeneralDutyCell(row: Record<string, unknown>): string | null {
  const candidates = [
    'column1General',
    'column_1_general',
    'general',
    'general_rate',
    'general_duty_rate',
    'col1_general',
    'col_1_general',
    'general_rate_of_duty_1',
  ];
  for (const k of candidates) {
    const v = row[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/** Classify 99xx line into 301/232 buckets. */
function classifyTradeRemedy(hts10: string): '301' | '232' | null {
  if (/^9903\.88\./.test(hts10)) return '301';
  if (/^9903\.(80|85)\./.test(hts10)) return '232';
  return null;
}

/** Nice notes text. */
function makeNotes(
  code: 'TRADE_REMEDY_301' | 'TRADE_REMEDY_232',
  hts10: string,
  generalCell?: string
) {
  const base =
    code === 'TRADE_REMEDY_301'
      ? `HTS ${hts10} – Section 301 (additional duty)`
      : `HTS ${hts10} – Section 232 (additional duty)`;
  const comp = generalCell && hasCompound(generalCell) ? '; contains specific/compound text' : '';
  return `${base}${comp}.`;
}

/**
 * PUBLIC: Scan HTS Ch.99 and insert ONE surcharge row for 301 and one for 232,
 * using the max ad-valorem percent found in the chapter for each program.
 */
export async function importUsTradeRemediesFromHTS(
  opts: ImportOpts = {}
): Promise<{ ok: true; count: number }> {
  const effectiveFrom = opts.effectiveFrom ?? jan1UTCOfCurrentYear();

  // Buckets track the max % found + an example hts10 for notes.
  type Bucket = { maxPct: number; anyHts10: string; anyText?: string };
  const buckets: Record<'TRADE_REMEDY_301' | 'TRADE_REMEDY_232', Bucket | undefined> = {
    TRADE_REMEDY_301: undefined,
    TRADE_REMEDY_232: undefined,
  };

  const rows = await exportChapterJson(99).catch(() => [] as Record<string, unknown>[]);
  for (const row of rows) {
    const hts10 = parseHts10(row);
    if (!hts10) continue;

    const klass = classifyTradeRemedy(hts10);
    if (!klass) continue;

    const general = getGeneralDutyCell(row);
    const pct = parsePercent(general);
    if (pct == null) continue;
    if (opts.skipFree && pct === 0) continue;

    const code = klass === '301' ? 'TRADE_REMEDY_301' : 'TRADE_REMEDY_232';
    const prev = buckets[code];
    if (!prev || pct > prev.maxPct) {
      buckets[code] = { maxPct: pct, anyHts10: hts10, anyText: general ?? undefined };
    }
  }

  const out: SurchargeInsert[] = [];
  // 301 (origin CN)
  if (buckets.TRADE_REMEDY_301) {
    const b = buckets.TRADE_REMEDY_301;
    out.push({
      dest: 'US',
      origin: 'CN',
      hs6: null, // v2: map note coverage into hs6
      code: 'TRADE_REMEDY_301',
      pctAmt: String(b.maxPct), // importer handles numeric-as-string → SQL numeric
      fixedAmt: null,
      effectiveFrom,
      effectiveTo: null,
      notes: makeNotes('TRADE_REMEDY_301', b.anyHts10, b.anyText),
    });
  }
  // 232 (no per-country carve-outs yet)
  if (buckets.TRADE_REMEDY_232) {
    const b = buckets.TRADE_REMEDY_232;
    out.push({
      dest: 'US',
      origin: null,
      hs6: null,
      code: 'TRADE_REMEDY_232',
      pctAmt: String(b.maxPct),
      fixedAmt: null,
      effectiveFrom,
      effectiveTo: null,
      notes: makeNotes('TRADE_REMEDY_232', b.anyHts10, b.anyText),
    });
  }

  if (out.length === 0) return { ok: true as const, count: 0 };
  const res = await importSurcharges(out as any);
  return { ok: true as const, count: res.count ?? out.length };
}
