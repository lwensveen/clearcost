import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  selectMock: vi.fn(),
  convertCurrencyWithMetaMock: vi.fn(),
}));

vi.mock('@clearcost/db', async () => {
  const actual = await vi.importActual<typeof import('@clearcost/db')>('@clearcost/db');
  return {
    ...actual,
    db: {
      ...actual.db,
      select: mocks.selectMock,
    },
  };
});

vi.mock('../../fx/services/convert-currency.js', () => ({
  convertCurrencyWithMeta: mocks.convertCurrencyWithMetaMock,
}));

import { computeDutyForRateId, computeDutyFromComponents } from './compute-duty.js';

function mockComponentRows(rows: unknown[]) {
  mocks.selectMock.mockReturnValue({
    from: () => ({
      where: async () => rows,
    }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.convertCurrencyWithMetaMock.mockImplementation(async (amount: number) => ({
    amount: Number(amount),
    meta: { missingRate: false, error: null },
  }));
});

describe('computeDutyFromComponents', () => {
  it('applies ad-valorem, specific, minimum and maximum constraints', () => {
    const out = computeDutyFromComponents(
      {
        customsValueDest: 1000,
        quantity: 2,
        netKg: 50,
      },
      [
        { componentType: 'advalorem', ratePct: 5 },
        { componentType: 'specific', amount: 1.2, uom: 'kg' },
        { componentType: 'minimum', amount: 100, uom: 'item' },
        { componentType: 'maximum', amount: 80, uom: 'item' },
      ]
    );

    expect(out.duty).toBe(160);
    expect(out.effectivePct).toBeCloseTo(0.16, 6);
  });
});

describe('computeDutyForRateId', () => {
  it('uses component rows and converts component amounts into destination currency', async () => {
    mockComponentRows([
      {
        componentType: 'advalorem',
        ratePct: '5.000',
        amount: null,
        currency: null,
        uom: null,
        qualifier: null,
        effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
        effectiveTo: null,
      },
      {
        componentType: 'specific',
        ratePct: null,
        amount: '2.000',
        currency: 'USD',
        uom: 'kg',
        qualifier: null,
        effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
        effectiveTo: null,
      },
    ]);
    mocks.convertCurrencyWithMetaMock.mockResolvedValueOnce({
      amount: 1.8,
      meta: { missingRate: false, error: null },
    });

    const out = await computeDutyForRateId(
      'rate_1',
      { customsValueDest: 100, netKg: 10 },
      {
        fallbackRatePct: 7,
        on: new Date('2025-01-15T00:00:00.000Z'),
        fxAsOf: new Date('2025-01-15T00:00:00.000Z'),
        destCurrency: 'EUR',
      }
    );

    expect(mocks.convertCurrencyWithMetaMock).toHaveBeenCalledWith(2, 'USD', 'EUR', {
      on: new Date('2025-01-15T00:00:00.000Z'),
      strict: true,
    });
    expect(out).toEqual({
      duty: 23,
      effectivePct: 0.23,
      usedComponents: true,
      fxMissingRate: false,
    });
  });

  it('falls back to parent ad-valorem rate when no components are available', async () => {
    mockComponentRows([]);

    const out = await computeDutyForRateId(
      'rate_1',
      { customsValueDest: 200 },
      { fallbackRatePct: 7, on: new Date('2025-01-15T00:00:00.000Z'), destCurrency: 'EUR' }
    );

    expect(out.duty).toBeCloseTo(14, 6);
    expect(out.effectivePct).toBeCloseTo(0.07, 6);
    expect(out.usedComponents).toBe(false);
    expect(out.fxMissingRate).toBe(false);
  });

  it('fails clearly when component currency code is invalid', async () => {
    mockComponentRows([
      {
        componentType: 'specific',
        ratePct: null,
        amount: '1.000',
        currency: 'US',
        uom: 'kg',
        qualifier: null,
        effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
        effectiveTo: null,
      },
    ]);

    await expect(
      computeDutyForRateId(
        'rate_1',
        { customsValueDest: 100, netKg: 10 },
        { on: new Date('2025-01-15T00:00:00.000Z'), destCurrency: 'EUR' }
      )
    ).rejects.toMatchObject({
      statusCode: 500,
      code: 'DUTY_COMPONENT_CURRENCY_INVALID',
    });
  });
});
