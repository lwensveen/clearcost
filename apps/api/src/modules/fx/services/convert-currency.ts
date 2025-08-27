import { fetchRate } from './fetch-rate.js';
import { buildFxCacheKey, fxCacheGet, fxCacheSet } from './utils.js';

type ConvertOpts = { on?: Date; strict?: boolean; ttlMs?: number };
const HUBS = ['EUR', 'USD'] as const;

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
export async function convertCurrency(
  amount: number,
  from: string,
  to: string,
  opts: ConvertOpts = {}
): Promise<number> {
  if (!Number.isFinite(amount)) return 0;

  const src = from.toUpperCase();
  const dst = to.toUpperCase();

  if (src === dst) return amount;

  const cacheKey = buildFxCacheKey(opts.on, src, dst);
  const cached = fxCacheGet(cacheKey);
  if (cached != null) return amount * cached;

  // 1) direct
  const direct = await fetchRate(src, dst, opts.on);
  if (direct != null) {
    fxCacheSet(cacheKey, direct, opts.ttlMs);
    fxCacheSet(buildFxCacheKey(opts.on, dst, src), 1 / direct, opts.ttlMs);
    return amount * direct;
  }

  // 2) reverse
  const reverse = await fetchRate(dst, src, opts.on);
  if (reverse != null) {
    const rate = 1 / reverse;
    fxCacheSet(cacheKey, rate, opts.ttlMs);
    fxCacheSet(buildFxCacheKey(opts.on, dst, src), reverse, opts.ttlMs);
    return amount * rate;
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
      return amount * rate;
    }
  }

  if (opts.strict) {
    const day = opts.on ? opts.on.toISOString().slice(0, 10) : 'latest';
    throw new Error(`FX rate unavailable for ${src}->${dst} on ${day}`);
  }

  // fallback: return unconverted amount
  return amount;
}
