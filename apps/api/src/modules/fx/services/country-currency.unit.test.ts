import { getCurrencyForCountry, normalizeCountryIso2 } from '@clearcost/types';
import { describe, expect, it } from 'vitest';

describe('country->currency mapping', () => {
  it.each([
    ['US', 'USD'],
    ['GB', 'GBP'],
    ['UK', 'GBP'],
    ['NL', 'EUR'],
    ['TH', 'THB'],
    ['JP', 'JPY'],
    ['jp', 'JPY'],
  ])('maps %s to %s', (country, currency) => {
    expect(getCurrencyForCountry(country)).toBe(currency);
  });

  it('returns null for unknown countries', () => {
    expect(getCurrencyForCountry('ZZ')).toBeNull();
  });

  it('normalizes supported ISO2 aliases', () => {
    expect(normalizeCountryIso2('UK')).toBe('GB');
    expect(normalizeCountryIso2('gb')).toBe('GB');
  });
});
