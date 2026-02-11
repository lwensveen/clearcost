import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json' with { type: 'json' };
import { VatBase } from './get-vat.js';
import { httpFetch } from '../../../lib/http.js';

countries.registerLocale(en);

export const USER_AGENT = 'clearcost-importer';
const DEFAULT_HTTP_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS ?? 15000);
export type VatRateKind = 'STANDARD' | 'REDUCED' | 'SUPER_REDUCED' | 'ZERO';

export type CountryVatRow = {
  ratePct: number; // VAT % (coerced from NUMERIC)
  vatBase: VatBase; // VAT base used for import VAT math
  vatRateKind: VatRateKind; // which rate kind this row represents
  source?: string | null;
  dataset?: string | null;
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

/**
 * Robust fetch helper for binary files:
 * - Stable UA
 * - Timeout (default 45s, override via HTTP_TIMEOUT_MS)
 * - Retries with exponential backoff
 * - Follows redirects
 */
export async function fetchArrayBuffer(
  url: string,
  opts?: { timeoutMs?: number; attempts?: number }
): Promise<ArrayBuffer> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS;
  const attempts = Math.max(1, opts?.attempts ?? 3);

  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await httpFetch(url, {
        headers: {
          'user-agent': `${USER_AGENT} (+https://clearcost.dev)`,
          accept:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        keepalive: false,
      } as RequestInit);

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Fetch failed ${res.status} ${res.statusText} – ${url}\n${body}`);
      }
      return await res.arrayBuffer();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, i * 300));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Common aliases so ISO-2 resolution succeeds. Keys are case-insensitive.
 * Left side: dataset label; right side: canonical English name used by the lib.
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
  // Handy extras
  'Ivory Coast': "Côte d'Ivoire",
  'Cabo Verde': 'Cape Verde',
};

/** Precompute a lowercase alias map for case-insensitive lookups. */
const COUNTRY_ALIASES_LC: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_ALIASES).map(([k, v]) => [k.toLowerCase(), v])
);

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
  // Resolve by country name (with case-insensitive aliases)
  const alias = COUNTRY_ALIASES_LC[raw.toLowerCase()];
  const canonical = alias ?? raw;

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
