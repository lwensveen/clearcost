import { describe, expect, it } from 'vitest';
import { EU_ISO2, isEuMember } from './eu.js';

describe('EU membership helpers', () => {
  it('contains all 27 EU member states', () => {
    expect(EU_ISO2.size).toBe(27);
  });

  it('isEuMember returns true for EU member states', () => {
    expect(isEuMember('NL')).toBe(true);
    expect(isEuMember('DE')).toBe(true);
    expect(isEuMember('FR')).toBe(true);
    expect(isEuMember('IT')).toBe(true);
  });

  it('isEuMember is case-insensitive', () => {
    expect(isEuMember('nl')).toBe(true);
    expect(isEuMember('de')).toBe(true);
  });

  it('isEuMember returns false for non-EU countries', () => {
    expect(isEuMember('US')).toBe(false);
    expect(isEuMember('GB')).toBe(false);
    expect(isEuMember('CN')).toBe(false);
    expect(isEuMember('CH')).toBe(false);
  });

  it('isEuMember returns false for EU pseudo-code itself', () => {
    expect(isEuMember('EU')).toBe(false);
  });
});
