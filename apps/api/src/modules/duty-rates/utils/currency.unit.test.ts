import { describe, expect, it } from 'vitest';
import { resolveDutyRateCurrency } from './currency.js';

describe('resolveDutyRateCurrency', () => {
  it('returns explicit ISO-4217 currency codes when provided', () => {
    expect(resolveDutyRateCurrency('JP', 'jpy')).toBe('JPY');
  });

  it('maps destination countries to currency when explicit currency is missing', () => {
    expect(resolveDutyRateCurrency('JP')).toBe('JPY');
    expect(resolveDutyRateCurrency('EU')).toBe('EUR');
  });

  it('fails clearly when explicit currency is invalid', () => {
    expect(() => resolveDutyRateCurrency('JP', 'JP')).toThrow(/invalid duty currency code/i);
    expect(() => resolveDutyRateCurrency('JP', 'JP')).toThrow(/JP/);
  });

  it('fails clearly when destination currency mapping is missing', () => {
    expect(() => resolveDutyRateCurrency('ZZ')).toThrow(/No ISO-4217 currency mapping/i);
  });
});
