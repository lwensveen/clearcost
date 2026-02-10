import { describe, expect, it } from 'vitest';
import { parseJpEditionEffectiveFrom } from './fetch-mfn.js';

describe('parseJpEditionEffectiveFrom', () => {
  it('parses YYYY_M_D edition URLs', () => {
    const out = parseJpEditionEffectiveFrom('https://www.customs.go.jp/english/tariff/2025_4_1/');
    expect(out?.toISOString()).toBe('2025-04-01T00:00:00.000Z');
  });

  it('parses YYYY_MM_DD edition URLs', () => {
    const out = parseJpEditionEffectiveFrom(
      'https://www.customs.go.jp/english/tariff/2025_10_15/index.htm'
    );
    expect(out?.toISOString()).toBe('2025-10-15T00:00:00.000Z');
  });

  it('defaults to the first day of month when day is omitted', () => {
    const out = parseJpEditionEffectiveFrom(
      'https://www.customs.go.jp/english/tariff/2025_10/index.htm'
    );
    expect(out?.toISOString()).toBe('2025-10-01T00:00:00.000Z');
  });

  it('returns null for invalid or non-edition URLs', () => {
    expect(
      parseJpEditionEffectiveFrom('https://www.customs.go.jp/english/tariff/2025_13_01/')
    ).toBe(null);
    expect(parseJpEditionEffectiveFrom('https://www.customs.go.jp/english/tariff/latest/')).toBe(
      null
    );
  });
});
