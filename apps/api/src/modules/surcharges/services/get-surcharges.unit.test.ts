import { describe, expect, it } from 'vitest';
import { latestSurchargeEffectiveFrom } from './get-surcharges.js';

describe('latestSurchargeEffectiveFrom', () => {
  it('returns the latest date across ranked rows', () => {
    const out = latestSurchargeEffectiveFrom([
      { effectiveFrom: new Date('2024-12-01T00:00:00.000Z') },
      { effectiveFrom: new Date('2025-02-15T00:00:00.000Z') },
      { effectiveFrom: new Date('2025-01-10T00:00:00.000Z') },
    ]);

    expect(out?.toISOString()).toBe('2025-02-15T00:00:00.000Z');
  });

  it('returns null when all rows have null dates', () => {
    const out = latestSurchargeEffectiveFrom([{ effectiveFrom: null }, { effectiveFrom: null }]);
    expect(out).toBeNull();
  });
});
