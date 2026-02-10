import { describe, expect, it } from 'vitest';
import { latestSurchargeEffectiveFrom, selectScopedSurchargeRows } from './get-surcharges.js';

type ScopedSurchargeRow = Parameters<typeof selectScopedSurchargeRows>[0][number];

function makeRow(overrides: Partial<ScopedSurchargeRow> = {}): ScopedSurchargeRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    dest: overrides.dest ?? 'US',
    origin: overrides.origin ?? null,
    hs6: overrides.hs6 ?? null,
    surchargeCode: overrides.surchargeCode ?? 'MPF',
    rateType: overrides.rateType ?? 'ad_valorem',
    applyLevel: overrides.applyLevel ?? 'entry',
    valueBasis: overrides.valueBasis ?? 'customs',
    transportMode: overrides.transportMode ?? 'ALL',
    currency: overrides.currency ?? 'USD',
    fixedAmt: overrides.fixedAmt ?? null,
    pctAmt: overrides.pctAmt ?? 0.003464,
    minAmt: overrides.minAmt ?? null,
    maxAmt: overrides.maxAmt ?? null,
    unitAmt: overrides.unitAmt ?? null,
    unitCode: overrides.unitCode ?? null,
    sourceUrl: overrides.sourceUrl ?? null,
    sourceRef: overrides.sourceRef ?? null,
    effectiveFrom: overrides.effectiveFrom ?? new Date('2025-01-01T00:00:00.000Z'),
    effectiveTo: overrides.effectiveTo ?? null,
    notes: overrides.notes ?? null,
  };
}

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

describe('selectScopedSurchargeRows', () => {
  it('keeps specific origin+hs6 row and drops generic fallback duplicate', () => {
    const rows = [
      makeRow({
        id: 'generic',
        surchargeCode: 'MPF',
        origin: null,
        hs6: null,
        transportMode: 'ALL',
      }),
      makeRow({
        id: 'specific',
        surchargeCode: 'MPF',
        origin: 'CN',
        hs6: '123456',
        transportMode: 'AIR',
      }),
    ];

    const out = selectScopedSurchargeRows(rows, {
      originUp: 'CN',
      hs6Key: '123456',
      mode: 'AIR',
      level: null,
    });

    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('specific');
  });

  it('falls back to generic row when no specific row exists', () => {
    const rows = [
      makeRow({
        id: 'generic',
        surchargeCode: 'MPF',
        origin: null,
        hs6: null,
        transportMode: 'ALL',
      }),
    ];

    const out = selectScopedSurchargeRows(rows, {
      originUp: 'CN',
      hs6Key: '123456',
      mode: 'AIR',
      level: null,
    });

    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('generic');
  });

  it('preserves distinct surcharge codes after scope selection', () => {
    const rows = [
      makeRow({ id: 'mpf-generic', surchargeCode: 'MPF', origin: null, hs6: null }),
      makeRow({
        id: 'mpf-specific',
        surchargeCode: 'MPF',
        origin: 'CN',
        hs6: '123456',
        transportMode: 'AIR',
      }),
      makeRow({ id: 'hmf-generic', surchargeCode: 'HMF', origin: null, hs6: null }),
    ];

    const out = selectScopedSurchargeRows(rows, {
      originUp: 'CN',
      hs6Key: '123456',
      mode: 'AIR',
      level: null,
    });

    expect(out.map((row) => row.id).sort()).toEqual(['hmf-generic', 'mpf-specific']);
  });
});
