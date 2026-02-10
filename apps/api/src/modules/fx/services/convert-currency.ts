import { fetchRate } from './fetch-rate.js';
import { buildFxCacheKey, fxCacheGet, fxCacheSet } from './utils.js';

type ConvertOpts = { on?: Date; strict?: boolean; ttlMs?: number };
const HUBS = ['EUR', 'USD'] as const;

export type ConvertCurrencyMeta = {
  missingRate: boolean;
  error: string | null;
};

type ConvertCurrencyResult = {
  amount: number;
  meta: ConvertCurrencyMeta;
};

/**
 * Convert an amount from one currency to another.
 * Strategy:
 * 1) short-circuit same currency
 * 2) cache check (day + pair)
 * 3) direct rate
 * 4) reverse rate (invert)
 * 5) triangulate via hubs (EUR / USD)
 * - Caches symmetric pairs on success.
 * - Uses `fetchRate(from,to,on)` which should return the latest rate
 *   with `fxAsOf <= on` (or the latest available if `on` undefined).
 */
async function convertCurrencyInternal(
  amount: number,
  from: string,
  to: string,
  opts: ConvertOpts = {}
): Promise<ConvertCurrencyResult> {
  if (!Number.isFinite(amount)) return { amount: 0, meta: { missingRate: false, error: null } };

  const src = from.toUpperCase();
  const dst = to.toUpperCase();

  if (src === dst) return { amount, meta: { missingRate: false, error: null } };

  const cacheKey = buildFxCacheKey(opts.on, src, dst);
  const cached = fxCacheGet(cacheKey);
  if (cached != null) return { amount: amount * cached, meta: { missingRate: false, error: null } };

  // 1) direct
  const direct = await fetchRate(src, dst, opts.on);
  if (direct != null) {
    fxCacheSet(cacheKey, direct, opts.ttlMs);
    fxCacheSet(buildFxCacheKey(opts.on, dst, src), 1 / direct, opts.ttlMs);
    return { amount: amount * direct, meta: { missingRate: false, error: null } };
  }

  // 2) reverse
  const reverse = await fetchRate(dst, src, opts.on);
  if (reverse != null) {
    const rate = 1 / reverse;
    fxCacheSet(cacheKey, rate, opts.ttlMs);
    fxCacheSet(buildFxCacheKey(opts.on, dst, src), reverse, opts.ttlMs);
    return { amount: amount * rate, meta: { missingRate: false, error: null } };
  }

  // 3) triangulate via hubs
  for (const hub of HUBS) {
    if (hub === src || hub === dst) continue; // skip trivial hub

    const legA = await fetchRate(src, hub, opts.on);
    const legB = await fetchRate(hub, dst, opts.on);

    if (legA != null && legB != null) {
      const rate = legA * legB;
      fxCacheSet(cacheKey, rate, opts.ttlMs);
      fxCacheSet(buildFxCacheKey(opts.on, dst, src), 1 / rate, opts.ttlMs);
      return { amount: amount * rate, meta: { missingRate: false, error: null } };
    }
  }

  const day = opts.on ? opts.on.toISOString().slice(0, 10) : 'latest';
  const error = `FX rate unavailable for ${src}->${dst} on ${day}`;
  if (opts.strict) throw new Error(error);

  // fallback: return unconverted amount + explicit missing metadata for callers
  return { amount, meta: { missingRate: true, error } };
}

export async function convertCurrency(
  amount: number,
  from: string,
  to: string,
  opts: ConvertOpts = {}
): Promise<number> {
  const out = await convertCurrencyInternal(amount, from, to, opts);
  return out.amount;
}

export async function convertCurrencyWithMeta(
  amount: number,
  from: string,
  to: string,
  opts: ConvertOpts = {}
): Promise<ConvertCurrencyResult> {
  return convertCurrencyInternal(amount, from, to, opts);
}
