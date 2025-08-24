import { fxCacheGet, fxCacheSet } from '../../quotes/utils.js';
import { fetchRate } from './fetch-rate.js';

export async function convertCurrency(amount: number, from: string, to: string) {
  if (from === to) return amount;

  const key = `${from}-${to}`;
  const cached = fxCacheGet(key);
  if (cached) return amount * cached;

  const direct = await fetchRate(from, to);
  if (direct) {
    fxCacheSet(key, direct);
    return amount * direct;
  }

  const rev = await fetchRate(to, from);
  if (rev) {
    fxCacheSet(key, 1 / rev);
    return amount / rev;
  }

  const toEUR = await fetchRate(from, 'EUR');
  const fromEUR = await fetchRate('EUR', to);
  if (toEUR && fromEUR) {
    const tri = toEUR * fromEUR;
    fxCacheSet(key, tri);
    return amount * tri;
  }

  return amount;
}
