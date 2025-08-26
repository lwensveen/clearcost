import countries from 'i18n-iso-countries';
import { VatBase } from './get-vat.js';

const USER_AGENT = 'clearcost-importer';

export type VatRateKind = 'STANDARD' | 'REDUCED' | 'SUPER_REDUCED' | 'ZERO';

export type CountryVatRow = {
  ratePct: number; // VAT % (coerced from NUMERIC)
  base: VatBase; // VAT base used for import VAT math
  kind: VatRateKind; // which rate kind this row represents
  effectiveFrom: Date | null;
};

/** YYYY-MM-DD (UTC) for effectiveFrom defaults. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Convert a JS number to NUMERIC(6,3) string (e.g., 21 -> "21.000"). */
export function toNumeric3String(n: string | number): string {
  const num = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(num) || num < 0) throw new Error(`invalid VAT rate: ${n}`);
  const s = num.toFixed(3);
  return Number(s) === 0 ? '0.000' : s;
}

/** Fetch helper with stable UA + helpful error messages. */
export async function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Fetch failed ${res.status} ${res.statusText} – ${url}\n${body}`);
  }
  return res.arrayBuffer();
}

/**
 * Common aliases across datasets so ISO-2 resolution succeeds.
 * Left side is dataset label; right side is canonical English name used by the countries lib.
 */
export const COUNTRY_ALIASES: Record<string, string> = {
  'Czech Republic': 'Czechia',
  Macedonia: 'North Macedonia',
  'Republic of North Macedonia': 'North Macedonia',
  'Congo, Dem. Rep.': 'Democratic Republic of the Congo',
  'Congo, Rep.': 'Congo',
  'Cote dIvoire': "Côte d'Ivoire",
  "Cote d'Ivoire": "Côte d'Ivoire",
  'Eswatini (Swaziland)': 'Eswatini',
  'United States': 'United States of America',
  'United Kingdom': 'United Kingdom of Great Britain and Northern Ireland',
  'Hong Kong, China': 'Hong Kong',
  'Macau, China': 'Macao',
};

/**
 * Map a country label (ISO2, ISO3, or English name with variant formatting) to ISO-2.
 * - Case-insensitive ISO code checks (e.g., "us", "Us", "uS" → "US")
 * - Try alias map, then exact English name, then fallback with parenthetical stripping.
 */
export function toIso2(nameOrCode: unknown): string | null {
  const raw = typeof nameOrCode === 'string' ? nameOrCode.trim() : String(nameOrCode ?? '').trim();
  if (!raw) return null;

  // Case-insensitive ISO code checks
  if (/^[A-Z]{2}$/i.test(raw)) return raw.toUpperCase();
  if (/^[A-Z]{3}$/i.test(raw)) {
    const a2 = countries.alpha3ToAlpha2(raw.toUpperCase());
    return a2 || null;
  }

  // Resolve by country name (with a few aliases)
  const canonical = (COUNTRY_ALIASES as Record<string, string>)[raw] ?? raw;

  // Try exact name first
  const direct = countries.getAlpha2Code(canonical, 'en');
  if (direct) return direct;

  // Fallback: strip parentheticals and take first comma-separated segment — safely
  const withoutParens = canonical.replace(/\s*\(.+?\)\s*/g, '');
  const firstSegment = (withoutParens.split(',')[0] ?? withoutParens).trim();
  const fallback = countries.getAlpha2Code(firstSegment, 'en');

  return fallback || null;
}

/**
 * Parse a "rate" cell robustly:
 * - Accepts plain numbers, "21", "21%", "5 / 10" (takes the smallest non-negative),
 *   and similar mixed formats observed in public spreadsheets.
 * - Returns `null` when no usable number is found.
 */
export function parseRateCell(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;

  // Extract all numeric tokens, then choose the smallest non-negative (e.g., "5 / 10" → 5)
  const matches = s.match(/(\d+(\.\d+)?)/g);
  if (!matches) return null;

  const nums = matches.map(Number).filter((x) => Number.isFinite(x) && x >= 0);
  if (!nums.length) return null;

  return Math.min(...nums);
}

/**
 * Coerce unknown date-ish input to Date, but only when defined.
 * - For NOT NULL columns with default (e.g., effectiveFrom), return `undefined`
 *   to let the DB default apply.
 * - For nullable columns (e.g., effectiveTo), pass `null` when explicitly null.
 */
export function toDateIfDefined(v: unknown): Date | undefined {
  if (v == null) return undefined;
  return v instanceof Date ? v : new Date(String(v));
}

export function toDateOrNull(v: unknown): Date | null {
  if (v == null) return null;
  return v instanceof Date ? v : new Date(String(v));
}
