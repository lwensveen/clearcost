import { getCurrencyForCountry } from '@clearcost/types';
import { describe, expect, it } from 'vitest';

describe('country->currency mapping', () => {
  it.each([
    ['US', 'USD'],
    ['GB', 'GBP'],
    ['NL', 'EUR'],
    ['TH', 'THB'],
    ['JP', 'JPY'],
  ])('maps %s to %s', (country, currency) => {
    expect(getCurrencyForCountry(country)).toBe(currency);
  });

  it('returns null for unknown countries', () => {
    expect(getCurrencyForCountry('ZZ')).toBeNull();
  });
});
