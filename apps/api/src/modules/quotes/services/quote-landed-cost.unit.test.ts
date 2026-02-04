import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  selectMock: vi.fn(),
  resolveHs6Mock: vi.fn(),
  convertCurrencyWithMetaMock: vi.fn(),
  getActiveDutyRateWithMetaMock: vi.fn(),
  getSurchargesScopedWithMetaMock: vi.fn(),
  getFreightWithMetaMock: vi.fn(),
  getVatForHs6WithMetaMock: vi.fn(),
  getCanonicalFxAsOfMock: vi.fn(),
  evaluateDeMinimisMock: vi.fn(),
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

vi.mock('../../hs-codes/services/resolve-hs6.js', () => ({
  resolveHs6: mocks.resolveHs6Mock,
}));

vi.mock('../../fx/services/convert-currency.js', () => ({
  convertCurrencyWithMeta: mocks.convertCurrencyWithMetaMock,
}));

vi.mock('../../duty-rates/services/get-active-duty-rate.js', () => ({
  getActiveDutyRateWithMeta: mocks.getActiveDutyRateWithMetaMock,
}));

vi.mock('../../surcharges/services/get-surcharges.js', () => ({
  getSurchargesScopedWithMeta: mocks.getSurchargesScopedWithMetaMock,
}));

vi.mock('../../freight/services/get-freight.js', () => ({
  getFreightWithMeta: mocks.getFreightWithMetaMock,
}));

vi.mock('../../vat/services/get-vat-for-hs6.js', () => ({
  getVatForHs6WithMeta: mocks.getVatForHs6WithMetaMock,
}));

vi.mock('../../fx/services/get-canonical-fx-asof.js', () => ({
  getCanonicalFxAsOf: mocks.getCanonicalFxAsOfMock,
}));

vi.mock('../../de-minimis/services/evaluate.js', () => ({
  evaluateDeMinimis: mocks.evaluateDeMinimisMock,
}));

import { quoteLandedCost } from './quote-landed-cost.js';

function mockMerchantContext(profile: unknown = undefined, regs: unknown[] = []) {
  mocks.selectMock
    .mockImplementationOnce(() => ({
      from: () => ({
        where: () => ({
          limit: async () => (profile ? [profile] : []),
        }),
      }),
    }))
    .mockImplementationOnce(() => ({
      from: () => ({
        where: async () => regs,
      }),
    }));
}

const baseInput = {
  merchantId: 'owner_1',
  origin: 'CN',
  dest: 'DE',
  itemValue: { amount: 100, currency: 'USD' },
  dimsCm: { l: 10, w: 10, h: 10 },
  weightKg: 2,
  categoryKey: 'apparel',
  hs6: '123456',
  mode: 'air' as const,
};

beforeEach(() => {
  vi.clearAllMocks();

  mocks.resolveHs6Mock.mockResolvedValue('123456');
  mocks.getCanonicalFxAsOfMock.mockResolvedValue(new Date('2025-01-01T00:00:00.000Z'));
  mocks.convertCurrencyWithMetaMock.mockImplementation(async (amount: number) => ({
    amount: Number(amount),
    meta: { missingRate: false },
  }));
  mocks.getFreightWithMetaMock.mockResolvedValue({
    value: { price: 20 },
    meta: { status: 'ok' },
  });
  mocks.getActiveDutyRateWithMetaMock.mockResolvedValue({
    value: { ratePct: 5, source: 'official', effectiveFrom: new Date('2025-01-01T00:00:00.000Z') },
    meta: {
      status: 'ok',
      dataset: 'official',
      effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
    },
  });
  mocks.getVatForHs6WithMetaMock.mockResolvedValue({
    value: {
      ratePct: 20,
      vatBase: 'CIF_PLUS_DUTY',
      source: 'default',
      effectiveFrom: new Date('2025-01-02T00:00:00.000Z'),
    },
    meta: { status: 'ok', dataset: null, effectiveFrom: new Date('2025-01-02T00:00:00.000Z') },
  });
  mocks.getSurchargesScopedWithMetaMock.mockResolvedValue({
    value: [{ fixedAmt: 5, pctAmt: 2 }],
    meta: {
      status: 'ok',
      dataset: 'trade-remedy',
      effectiveFrom: new Date('2025-01-03T00:00:00.000Z'),
    },
  });
  mocks.evaluateDeMinimisMock.mockResolvedValue({
    duty: null,
    vat: null,
    suppressDuty: false,
    suppressVAT: false,
  });
});

describe('quoteLandedCost', () => {
  it('computes a quote with authoritative confidence and source metadata', async () => {
    mockMerchantContext(undefined, []);

    const out = await quoteLandedCost(baseInput);

    expect(out.quote.total).toBe(158.6);
    expect(out.quote.componentConfidence).toEqual({
      duty: 'authoritative',
      vat: 'authoritative',
      surcharges: 'authoritative',
      freight: 'authoritative',
      fx: 'authoritative',
    });
    expect(out.quote.overallConfidence).toBe('authoritative');
    expect(out.quote.missingComponents).toEqual([]);
    expect(out.quote.sources).toEqual({
      duty: {
        provider: null,
        dataset: 'official',
        asOf: null,
        effectiveFrom: '2025-01-01T00:00:00.000Z',
      },
      vat: {
        provider: null,
        dataset: null,
        asOf: null,
        effectiveFrom: '2025-01-02T00:00:00.000Z',
      },
      surcharges: {
        provider: null,
        dataset: 'trade-remedy',
        asOf: null,
        effectiveFrom: '2025-01-03T00:00:00.000Z',
      },
    });
  });

  it('treats no_match surcharges as authoritative with empty fee result', async () => {
    mockMerchantContext(undefined, []);
    mocks.getSurchargesScopedWithMetaMock.mockResolvedValue({
      value: [],
      meta: { status: 'no_match', dataset: null, effectiveFrom: null },
    });

    const out = await quoteLandedCost(baseInput);

    expect(out.quote.components.fees).toBe(0);
    expect(out.quote.componentConfidence.surcharges).toBe('authoritative');
    expect(out.quote.missingComponents).not.toContain('surcharges');
  });

  it('marks out_of_scope vat as estimated', async () => {
    mockMerchantContext(undefined, []);
    mocks.getVatForHs6WithMetaMock.mockResolvedValue({
      value: null,
      meta: { status: 'out_of_scope', dataset: null, effectiveFrom: null },
    });

    const out = await quoteLandedCost(baseInput);

    expect(out.quote.componentConfidence.vat).toBe('estimated');
    expect(out.quote.overallConfidence).toBe('estimated');
  });

  it('marks no_dataset lookups as missing components', async () => {
    mockMerchantContext(undefined, []);
    mocks.getActiveDutyRateWithMetaMock.mockResolvedValue({
      value: null,
      meta: { status: 'no_dataset', dataset: null, effectiveFrom: null },
    });
    mocks.getVatForHs6WithMetaMock.mockResolvedValue({
      value: null,
      meta: { status: 'error', dataset: null, effectiveFrom: null },
    });

    const out = await quoteLandedCost(baseInput);

    expect(out.quote.missingComponents).toEqual(expect.arrayContaining(['duty', 'vat']));
    expect(out.quote.overallConfidence).toBe('missing');
  });

  it('uses freight override as estimated instead of missing', async () => {
    mockMerchantContext(undefined, []);
    mocks.getFreightWithMetaMock.mockResolvedValue({
      value: null,
      meta: { status: 'no_dataset', dataset: null, effectiveFrom: null },
    });

    const out = await quoteLandedCost(baseInput, { freightInDestOverride: 15 });

    expect(out.quote.freight).toBe(15);
    expect(out.quote.componentConfidence.freight).toBe('estimated');
    expect(out.quote.missingComponents).not.toContain('freight');
  });

  it('marks fx as missing when conversion reports missingRate', async () => {
    mockMerchantContext(undefined, []);
    mocks.convertCurrencyWithMetaMock
      .mockResolvedValueOnce({ amount: 20, meta: { missingRate: false } }) // freight
      .mockResolvedValueOnce({ amount: 100, meta: { missingRate: true } }) // item
      .mockResolvedValueOnce({ amount: 100, meta: { missingRate: false } }); // eur conversion

    const out = await quoteLandedCost(baseInput);

    expect(out.quote.componentConfidence.fx).toBe('missing');
    expect(out.quote.missingComponents).toContain('fx');
  });

  it('calculates IOSS checkout VAT when merchant and registration allow it', async () => {
    mockMerchantContext({ collectVatAtCheckout: 'always', chargeShippingAtCheckout: true }, [
      { jurisdiction: 'EU', scheme: 'IOSS' },
    ]);

    const out = await quoteLandedCost(baseInput);

    expect(out.quote.components.checkoutVAT).toBe(24);
    expect(out.quote.components.vat).toBe(0);
    expect(out.quote.policy).toContain('IOSS');
  });

  it('suppresses duty and vat when de minimis says both are suppressed', async () => {
    mockMerchantContext(undefined, []);
    mocks.evaluateDeMinimisMock.mockResolvedValue({
      duty: { thresholdDest: 800, deMinimisBasis: 'CIF', under: true },
      vat: { thresholdDest: 800, deMinimisBasis: 'CIF', under: true },
      suppressDuty: true,
      suppressVAT: true,
    });

    const out = await quoteLandedCost(baseInput);

    expect(out.quote.components.duty).toBe(0);
    expect(out.quote.components.vat).toBe(0);
    expect(out.quote.policy).toContain('De minimis: duty & VAT');
  });

  it('uses VAT base CIF when returned by VAT lookup', async () => {
    mockMerchantContext(undefined, []);
    mocks.getVatForHs6WithMetaMock.mockResolvedValue({
      value: {
        ratePct: 20,
        vatBase: 'CIF',
        source: 'default',
        effectiveFrom: new Date('2025-01-02T00:00:00.000Z'),
      },
      meta: { status: 'ok', dataset: null, effectiveFrom: new Date('2025-01-02T00:00:00.000Z') },
    });

    const out = await quoteLandedCost(baseInput);

    expect(out.quote.components.vat).toBe(24);
  });

  it('uses JPY rounding rules (0 decimals)', async () => {
    mockMerchantContext(undefined, []);
    const out = await quoteLandedCost({ ...baseInput, dest: 'JPY' });

    expect(Number.isInteger(out.quote.total)).toBe(true);
    expect(Number.isInteger(out.quote.components.CIF)).toBe(true);
  });

  it('supports merchant-less flow and sea mode chargeable calculation', async () => {
    mocks.getFreightWithMetaMock.mockResolvedValue({
      value: { price: 15 },
      meta: { status: 'ok' },
    });
    const out = await quoteLandedCost({
      ...baseInput,
      merchantId: undefined,
      mode: 'sea',
    });

    expect(mocks.selectMock).not.toHaveBeenCalled();
    expect(out.quote.chargeableKg).toBe(baseInput.weightKg);
    expect(out.quote.freight).toBe(15);
  });

  it('de minimis policy message handles duty-only and VAT-only suppression', async () => {
    mockMerchantContext(undefined, []);
    mocks.evaluateDeMinimisMock.mockResolvedValueOnce({
      duty: { thresholdDest: 800, deMinimisBasis: 'CIF', under: true },
      vat: null,
      suppressDuty: true,
      suppressVAT: false,
    });
    const dutyOnly = await quoteLandedCost(baseInput);
    expect(dutyOnly.quote.policy).toContain('duty not charged');

    mockMerchantContext(undefined, []);
    mocks.evaluateDeMinimisMock.mockResolvedValueOnce({
      duty: null,
      vat: { thresholdDest: 800, deMinimisBasis: 'CIF', under: true },
      suppressDuty: false,
      suppressVAT: true,
    });
    const vatOnly = await quoteLandedCost(baseInput);
    expect(vatOnly.quote.policy).toContain('VAT not charged');
  });

  it('handles missing freight row and sparse surcharge rows without NaN', async () => {
    mockMerchantContext(undefined, []);
    mocks.getFreightWithMetaMock.mockResolvedValue({
      value: null,
      meta: { status: 'no_match' },
    });
    mocks.getSurchargesScopedWithMetaMock.mockResolvedValue({
      value: [{}, { fixedAmt: undefined, pctAmt: undefined }],
      meta: { status: 'ok', dataset: null, effectiveFrom: null },
    });

    const out = await quoteLandedCost(baseInput);

    expect(out.quote.freight).toBe(0);
    expect(out.quote.components.fees).toBe(0);
  });

  it('IOSS path tolerates missing VAT info and omits checkoutVAT when zero', async () => {
    mockMerchantContext({ collectVatAtCheckout: 'always', chargeShippingAtCheckout: false }, [
      { jurisdiction: 'EU', scheme: 'IOSS' },
    ]);
    mocks.getVatForHs6WithMetaMock.mockResolvedValue({
      value: null,
      meta: { status: 'no_match', dataset: null, effectiveFrom: null },
    });

    const out = await quoteLandedCost(baseInput);

    expect(out.quote.policy).toContain('IOSS');
    expect(out.quote.components.checkoutVAT).toBeUndefined();
  });
});
