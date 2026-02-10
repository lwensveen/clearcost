import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  selectMock: vi.fn(),
  convertCurrencyMock: vi.fn(),
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
  convertCurrency: mocks.convertCurrencyMock,
}));

import { evaluateDeMinimis } from './evaluate.js';

const FX_AS_OF = new Date('2025-01-31T14:00:00.000Z');
const FX_DAY = new Date('2025-01-31T00:00:00.000Z');

const dutyRowUsd = {
  deMinimisKind: 'DUTY',
  deMinimisBasis: 'INTRINSIC',
  currency: 'USD',
  value: '100',
  effectiveFrom: new Date('2024-01-01T00:00:00.000Z'),
  effectiveTo: null,
};

function mockRows(rows: unknown[]) {
  mocks.selectMock.mockImplementationOnce(() => ({
    from: () => ({
      where: () => ({
        orderBy: async () => rows,
      }),
    }),
  }));
}

describe('evaluateDeMinimis', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('converts thresholds into mapped destination currency before comparison', async () => {
    mockRows([dutyRowUsd]);
    mocks.convertCurrencyMock.mockResolvedValueOnce(90);

    const out = await evaluateDeMinimis({
      dest: 'NL',
      goodsDest: 80,
      freightDest: 0,
      fxAsOf: FX_AS_OF,
    });

    expect(mocks.convertCurrencyMock).toHaveBeenCalledWith(100, 'USD', 'EUR', {
      on: FX_DAY,
      strict: true,
    });
    expect(out.duty).toEqual({
      thresholdDest: 90,
      deMinimisBasis: 'INTRINSIC',
      under: true,
    });
    expect(out.suppressDuty).toBe(true);
  });

  it('uses explicit destination currency override when provided', async () => {
    mockRows([dutyRowUsd]);
    mocks.convertCurrencyMock.mockResolvedValueOnce(75);

    const out = await evaluateDeMinimis({
      dest: 'NL',
      destCurrency: 'GBP',
      goodsDest: 80,
      freightDest: 0,
      fxAsOf: FX_AS_OF,
    });

    expect(mocks.convertCurrencyMock).toHaveBeenCalledWith(100, 'USD', 'GBP', {
      on: FX_DAY,
      strict: true,
    });
    expect(out.suppressDuty).toBe(false);
  });

  it('normalizes UK destination alias to GB for currency resolution', async () => {
    mockRows([dutyRowUsd]);
    mocks.convertCurrencyMock.mockResolvedValueOnce(80);

    const out = await evaluateDeMinimis({
      dest: 'UK',
      goodsDest: 70,
      freightDest: 0,
      fxAsOf: FX_AS_OF,
    });

    expect(mocks.convertCurrencyMock).toHaveBeenCalledWith(100, 'USD', 'GBP', {
      on: FX_DAY,
      strict: true,
    });
    expect(out.suppressDuty).toBe(true);
  });

  it('fails clearly when destination country has no currency mapping', async () => {
    await expect(
      evaluateDeMinimis({
        dest: 'ZZ',
        goodsDest: 10,
        freightDest: 0,
        fxAsOf: FX_AS_OF,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'DEST_CURRENCY_UNMAPPED',
    });

    expect(mocks.selectMock).not.toHaveBeenCalled();
  });

  it('fails clearly when FX conversion for threshold currency is unavailable', async () => {
    mockRows([dutyRowUsd]);
    mocks.convertCurrencyMock.mockRejectedValueOnce(
      new Error('FX rate unavailable for USD->EUR on 2025-01-31')
    );

    await expect(
      evaluateDeMinimis({
        dest: 'NL',
        goodsDest: 10,
        freightDest: 0,
        fxAsOf: FX_AS_OF,
      })
    ).rejects.toMatchObject({
      statusCode: 500,
      code: 'DE_MINIMIS_FX_UNAVAILABLE',
    });
  });
});
