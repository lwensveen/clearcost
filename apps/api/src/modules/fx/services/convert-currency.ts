import { fxCacheGet, fxCacheSet } from '../../quotes/utils.js';
import { fetchRate } from './fetch-rate.js';

type ConvertOpts = { on?: Date; strict?: boolean; ttlMs?: number };
const HUBS = ['EUR', 'USD'] as const;

export async function convertCurrency(
  amount: number,
  from: string,
  to: string,
  opts: ConvertOpts = {}
) {
  if (!Number.isFinite(amount)) return 0;
  if (from === to) return amount;

  const day = opts.on ? opts.on.toISOString().slice(0, 10) : 'latest';
  const key = `${day}:${from}-${to}`;
  const cached = fxCacheGet(key);
  if (cached) return amount * cached;

  const direct = await fetchRate(from, to, opts.on);
  if (direct) {
    fxCacheSet(key, direct, opts.ttlMs);
    fxCacheSet(`${day}:${to}-${from}`, 1 / direct, opts.ttlMs);
    return amount * direct;
  }

  const rev = await fetchRate(to, from, opts.on);
  if (rev) {
    const r = 1 / rev;
    fxCacheSet(key, r, opts.ttlMs);
    fxCacheSet(`${day}:${to}-${from}`, rev, opts.ttlMs);
    return amount * r;
  }

  for (const hub of HUBS) {
    const a = await fetchRate(from, hub, opts.on);
    const b = await fetchRate(hub, to, opts.on);
    if (a && b) {
      const tri = a * b;
      fxCacheSet(key, tri, opts.ttlMs);
      fxCacheSet(`${day}:${to}-${from}`, 1 / tri, opts.ttlMs);
      return amount * tri;
    }
  }

  if (opts.strict) throw new Error(`FX rate unavailable for ${from}->${to} on ${day}`);

  return amount;
}
