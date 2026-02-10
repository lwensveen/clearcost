import { describe, expect, it } from 'vitest';
import { adValoremPercentToFractionString } from './pct.js';

describe('adValoremPercentToFractionString', () => {
  it('converts whole percent values into fractional strings', () => {
    expect(adValoremPercentToFractionString(25)).toBe('0.250000');
    expect(adValoremPercentToFractionString(0.3464)).toBe('0.003464');
  });
});
