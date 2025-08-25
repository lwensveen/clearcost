export const EU_ISO2 = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
]);

export function volumetricKg({ l, w, h }: { l: number; w: number; h: number }) {
  return (l * w * h) / 5000;
}

export function volumeM3({ l, w, h }: { l: number; w: number; h: number }) {
  return (l * w * h) / 1_000_000;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;

type CacheEntry = { value: number; expiresAt: number };
const fxCache = new Map<string, CacheEntry>();

export function fxCacheGet(key: string): number | null {
  const hit = fxCache.get(key);

  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    fxCache.delete(key);
    return null;
  }
  return hit.value;
}

export function fxCacheSet(key: string, value: number, ttlMs: number = DEFAULT_TTL_MS) {
  fxCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}
