import { describe, expect, it } from 'vitest';
import {
  freightLaneLookupCandidates,
  requireFreightIso3,
  toFreightIso3,
} from './lane-country-code.js';

describe('freight lane country code normalization', () => {
  it.each([
    ['CN', 'CHN'],
    ['chn', 'CHN'],
    ['UK', 'GBR'],
    ['GB', 'GBR'],
    ['TH', 'THA'],
  ])('maps %s to ISO3 %s', (input, expected) => {
    expect(toFreightIso3(input)).toBe(expected);
  });

  it('builds lookup candidates that match both ISO3 and ISO2 rows', () => {
    expect(freightLaneLookupCandidates('CN')).toEqual(['CHN', 'CN']);
    expect(freightLaneLookupCandidates('CHN')).toEqual(['CHN', 'CN']);
    expect(freightLaneLookupCandidates('UK')).toEqual(['GBR', 'GB']);
  });

  it('falls back to normalized raw input when code is unknown', () => {
    expect(freightLaneLookupCandidates('zz')).toEqual(['ZZ']);
    expect(toFreightIso3('ZZ')).toBeNull();
  });

  it('throws a clear error when strict ISO3 normalization cannot resolve a code', () => {
    expect(() => requireFreightIso3('ZZ', 'origin')).toThrow(
      'Invalid freight lane origin country "ZZ"; expected ISO2/ISO3'
    );
  });
});
