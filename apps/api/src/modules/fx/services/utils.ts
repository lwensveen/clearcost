/**
 * Simple ISO-4217 currency code validator.
 */
export const ISO_4217_REGEX = /^[A-Z]{3}$/;

/**
 * Convert a JS number into a Postgres NUMERIC(18,8) string.
 * - No scientific notation
 * - Exactly 8 decimal places
 * - Avoids "-0.00000000"
 */
export function toNumeric8String(value: number): string {
  if (!Number.isFinite(value) || value <= 0) throw new Error('Invalid positive rate');
  const fixed = value.toFixed(8);
  return Number(fixed) === 0 ? '0.00000000' : fixed;
}

/**
 * Format a Date as YYYY-MM-DD (UTC).
 */
export function formatISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Convert a YYYY-MM-DD string to a Date fixed at midnight UTC.
 */
export function toMidnightUTC(yyyymmdd: string): Date {
  return new Date(`${yyyymmdd}T00:00:00Z`);
}

/**
 * Absolute difference between two dates in whole days.
 */
export function calculateDaysBetween(a: Date, b: Date): number {
  return Math.abs((+a - +b) / 86_400_000);
}

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

type CacheEntry = { value: number; expiresAt: number };
const fxCache = new Map<string, CacheEntry>();

/** Build a stable cache key: YYYY-MM-DD or 'latest' + pair 'FROM-TO' (uppercased) */
export function buildFxCacheKey(on: Date | undefined, from: string, to: string): string {
  const day = on ? on.toISOString().slice(0, 10) : 'latest';
  return `${day}:${from.toUpperCase()}-${to.toUpperCase()}`;
}

export function fxCacheGet(key: string): number | null {
  const hit = fxCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    fxCache.delete(key);
    return null;
  }
  return hit.value;
}

export function fxCacheSet(key: string, value: number, ttlMs: number = DEFAULT_TTL_MS): void {
  if (!Number.isFinite(value) || value <= 0) return; // don't poison cache
  fxCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}
