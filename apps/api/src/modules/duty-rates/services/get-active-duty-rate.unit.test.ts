import { describe, expect, it } from 'vitest';
import { noteHasPartnerToken, partnerTokenPattern } from './get-active-duty-rate.js';

describe('partner notes token matching', () => {
  it('builds non-letter boundary pattern for valid ISO2 partner', () => {
    expect(partnerTokenPattern('in')).toBe('(^|[^A-Z])IN([^A-Z]|$)');
  });

  it('returns empty pattern for invalid partner code input', () => {
    expect(partnerTokenPattern('IND')).toBe('');
    expect(partnerTokenPattern('1N')).toBe('');
  });

  it('matches standalone partner tokens in notes', () => {
    expect(noteHasPartnerToken('Preferential tariff for IN goods', 'IN')).toBe(true);
    expect(noteHasPartnerToken('Applies to origin: CN/IN', 'IN')).toBe(true);
    expect(noteHasPartnerToken('FTA partner (GB)', 'GB')).toBe(true);
  });

  it('does not false-match partner inside larger words', () => {
    expect(noteHasPartnerToken('china tariff schedule', 'IN')).toBe(false);
    expect(noteHasPartnerToken('beginning of period', 'IN')).toBe(false);
    expect(noteHasPartnerToken('Kingdom rules apply', 'GB')).toBe(false);
  });
});
