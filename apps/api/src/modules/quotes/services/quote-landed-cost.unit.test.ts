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
  getDatasetFreshnessSnapshotMock: vi.fn(),
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

vi.mock('../../health/services.js', () => ({
  getDatasetFreshnessSnapshot: mocks.getDatasetFreshnessSnapshotMock,
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
  vi.resetAllMocks();

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
  mocks.getDatasetFreshnessSnapshotMock.mockResolvedValue({
    now: new Date('2025-01-01T00:00:00.000Z'),
    datasets: {
      duties: {
        scheduled: true,
        freshnessThresholdHours: 192,
        lastSuccessAt: new Date('2025-01-01T00:00:00.000Z'),
        lastAttemptAt: new Date('2025-01-01T00:00:00.000Z'),
        source: 'WITS',
        latestRunAt: new Date('2025-01-01T00:00:00.000Z'),
        ageHours: 0,
        stale: false,
      },
      vat: {
        scheduled: true,
        freshnessThresholdHours: 48,
        lastSuccessAt: new Date('2025-01-01T00:00:00.000Z'),
        lastAttemptAt: new Date('2025-01-01T00:00:00.000Z'),
        source: null,
        latestRunAt: new Date('2025-01-01T00:00:00.000Z'),
        ageHours: 0,
        stale: false,
      },
      'de-minimis': {
        scheduled: true,
        freshnessThresholdHours: 48,
        lastSuccessAt: null,
        lastAttemptAt: null,
        source: null,
        latestRunAt: null,
        ageHours: null,
        stale: true,
      },
      surcharges: {
        scheduled: true,
        freshnessThresholdHours: 192,
        lastSuccessAt: new Date('2025-01-01T00:00:00.000Z'),
        lastAttemptAt: new Date('2025-01-01T00:00:00.000Z'),
        source: null,
        latestRunAt: new Date('2025-01-01T00:00:00.000Z'),
        ageHours: 0,
        stale: false,
      },
      'hs-aliases': {
        scheduled: true,
        freshnessThresholdHours: 192,
        lastSuccessAt: new Date('2025-01-01T00:00:00.000Z'),
        lastAttemptAt: new Date('2025-01-01T00:00:00.000Z'),
        source: null,
        latestRunAt: new Date('2025-01-01T00:00:00.000Z'),
        ageHours: 0,
        stale: false,
      },
      freight: {
        scheduled: false,
        freshnessThresholdHours: null,
        lastSuccessAt: null,
        lastAttemptAt: null,
        source: null,
        latestRunAt: null,
        ageHours: null,
        stale: null,
      },
      fx: {
        scheduled: true,
        freshnessThresholdHours: 30,
        lastSuccessAt: new Date('2025-01-01T00:00:00.000Z'),
        lastAttemptAt: new Date('2025-01-01T00:00:00.000Z'),
        source: 'ECB',
        latestRunAt: new Date('2025-01-01T00:00:00.000Z'),
        ageHours: 0,
        stale: false,
      },
      notices: {
        scheduled: true,
        freshnessThresholdHours: 48,
        lastSuccessAt: new Date('2025-01-01T00:00:00.000Z'),
        lastAttemptAt: new Date('2025-01-01T00:00:00.000Z'),
        source: null,
        latestRunAt: new Date('2025-01-01T00:00:00.000Z'),
        ageHours: 0,
        stale: false,
      },
    },
  });
  delete process.env.QUOTE_STRICT_FRESHNESS;
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
    expect(out.quote.explainability).toEqual({
      duty: {
        dutyRule: null,
        partner: null,
        source: 'official',
        effectiveFrom: '2025-01-01T00:00:00.000Z',
        suppressedByDeMinimis: false,
      },
      vat: {
        source: 'default',
        vatBase: 'CIF_PLUS_DUTY',
        effectiveFrom: '2025-01-02T00:00:00.000Z',
        checkoutCollected: false,
        suppressedByDeMinimis: false,
      },
      deMinimis: {
        suppressDuty: false,
        suppressVAT: false,
        dutyBasis: null,
        vatBasis: null,
      },
      surcharges: {
        appliedCodes: [],
        appliedCount: 1,
        sourceRefs: [],
      },
      freight: {
        model: 'card',
        lookupStatus: 'ok',
        unit: 'kg',
        qty: 2,
      },
    });
  });

  it('uses mapped destination currency codes for FX conversion and quote totals', async () => {
    mockMerchantContext(undefined, []);
    const fxAsOf = new Date('2025-01-01T00:00:00.000Z');
    const baseCurrency = (process.env.CURRENCY_BASE ?? 'USD').toUpperCase();

    mocks.convertCurrencyWithMetaMock
      .mockResolvedValueOnce({ amount: 18, meta: { missingRate: false, error: null } }) // freight: USD->EUR
      .mockResolvedValueOnce({ amount: 90, meta: { missingRate: false, error: null } }) // goods: USD->EUR
      .mockResolvedValueOnce({ amount: 90, meta: { missingRate: false, error: null } }); // EUR->EUR

    const out = await quoteLandedCost({ ...baseInput, dest: 'NL' });

    expect(out.quote.currency).toBe('EUR');
    expect(out.quote.total).toBe(143.24);
    expect(mocks.convertCurrencyWithMetaMock).toHaveBeenNthCalledWith(1, 20, baseCurrency, 'EUR', {
      on: fxAsOf,
      strict: true,
    });
    expect(mocks.convertCurrencyWithMetaMock).toHaveBeenNthCalledWith(2, 100, 'USD', 'EUR', {
      on: fxAsOf,
      strict: true,
    });
    expect(mocks.evaluateDeMinimisMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'NL',
        destCurrency: 'EUR',
      })
    );
  });

  it('normalizes ISO2 lanes to ISO3 for freight lookup matching', async () => {
    mockMerchantContext(undefined, []);

    await quoteLandedCost(baseInput);

    expect(mocks.getFreightWithMetaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'CHN',
        dest: 'DEU',
      })
    );
  });

  it('passes normalized origin as duty partner for duty-rate matching', async () => {
    mockMerchantContext(undefined, []);

    await quoteLandedCost(baseInput);

    expect(mocks.getActiveDutyRateWithMetaMock).toHaveBeenCalledWith(
      'DE',
      '123456',
      expect.any(Date),
      { partner: 'CN' }
    );
  });

  it('falls back to uppercased origin when ISO3 conversion is unavailable', async () => {
    mockMerchantContext(undefined, []);

    await quoteLandedCost({ ...baseInput, origin: 'zz' });

    expect(mocks.getFreightWithMetaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'ZZ',
        dest: 'DEU',
      })
    );
  });

  it('normalizes UK alias to GBR for freight lookup', async () => {
    mockMerchantContext(undefined, []);

    await quoteLandedCost({ ...baseInput, origin: 'UK' });

    expect(mocks.getFreightWithMetaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'GBR',
        dest: 'DEU',
      })
    );
    expect(mocks.getActiveDutyRateWithMetaMock).toHaveBeenCalledWith(
      'DE',
      '123456',
      expect.any(Date),
      { partner: 'GB' }
    );
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
    const out = await quoteLandedCost({ ...baseInput, dest: 'JP' });

    expect(Number.isInteger(out.quote.total)).toBe(true);
    expect(Number.isInteger(out.quote.components.CIF)).toBe(true);
  });

  it('fails clearly when destination country has no currency mapping', async () => {
    mockMerchantContext(undefined, []);

    await expect(quoteLandedCost({ ...baseInput, dest: 'ZZ' })).rejects.toMatchObject({
      statusCode: 400,
      code: 'DEST_CURRENCY_UNMAPPED',
    });
    expect(mocks.convertCurrencyWithMetaMock).not.toHaveBeenCalled();
  });

  it('fails clearly when strict FX conversion has no available rate', async () => {
    mockMerchantContext(undefined, []);
    mocks.convertCurrencyWithMetaMock.mockRejectedValueOnce(
      new Error('FX rate unavailable for USD->EUR on 2025-01-01')
    );

    await expect(quoteLandedCost(baseInput)).rejects.toThrow('FX rate unavailable');
    expect(mocks.evaluateDeMinimisMock).not.toHaveBeenCalled();
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

  it.each([
    {
      name: 'CN->DE authoritative baseline',
      input: { origin: 'CN', dest: 'DE' },
      duty: 'ok',
      vat: 'ok',
      surcharges: 'ok',
      freight: 'ok',
      fxMissingRate: false,
      expectedOverall: 'authoritative',
      expectedMissing: [] as string[],
    },
    {
      name: 'CN->DE no_match duty still authoritative',
      input: { origin: 'CN', dest: 'DE' },
      duty: 'no_match',
      vat: 'ok',
      surcharges: 'ok',
      freight: 'ok',
      fxMissingRate: false,
      expectedOverall: 'authoritative',
      expectedMissing: [] as string[],
    },
    {
      name: 'CN->DE no_dataset duty is missing',
      input: { origin: 'CN', dest: 'DE' },
      duty: 'no_dataset',
      vat: 'ok',
      surcharges: 'ok',
      freight: 'ok',
      fxMissingRate: false,
      expectedOverall: 'missing',
      expectedMissing: ['duty'],
    },
    {
      name: 'CN->US vat out_of_scope yields estimated',
      input: { origin: 'CN', dest: 'US' },
      duty: 'ok',
      vat: 'out_of_scope',
      surcharges: 'ok',
      freight: 'ok',
      fxMissingRate: false,
      expectedOverall: 'estimated',
      expectedMissing: [] as string[],
    },
    {
      name: 'CN->US no_match surcharges does not mark missing',
      input: { origin: 'CN', dest: 'US' },
      duty: 'ok',
      vat: 'out_of_scope',
      surcharges: 'no_match',
      freight: 'ok',
      fxMissingRate: false,
      expectedOverall: 'estimated',
      expectedMissing: [] as string[],
    },
    {
      name: 'JP->GB freight dataset missing marks missing freight',
      input: { origin: 'JP', dest: 'GB' },
      duty: 'ok',
      vat: 'ok',
      surcharges: 'ok',
      freight: 'no_dataset',
      fxMissingRate: false,
      expectedOverall: 'missing',
      expectedMissing: ['freight'],
    },
    {
      name: 'ID->DE surcharge dataset missing marks missing',
      input: { origin: 'ID', dest: 'DE' },
      duty: 'ok',
      vat: 'ok',
      surcharges: 'no_dataset',
      freight: 'ok',
      fxMissingRate: false,
      expectedOverall: 'missing',
      expectedMissing: ['surcharges'],
    },
    {
      name: 'SG->US fx fallback marks missing fx only',
      input: { origin: 'SG', dest: 'US' },
      duty: 'ok',
      vat: 'out_of_scope',
      surcharges: 'ok',
      freight: 'ok',
      fxMissingRate: true,
      expectedOverall: 'missing',
      expectedMissing: ['fx'],
    },
    {
      name: 'VN->EU vat lookup error marks missing vat',
      input: { origin: 'VN', dest: 'DE' },
      duty: 'ok',
      vat: 'error',
      surcharges: 'ok',
      freight: 'ok',
      fxMissingRate: false,
      expectedOverall: 'missing',
      expectedMissing: ['vat'],
    },
    {
      name: 'TH->EU strict freshness escalates stale duty to missing',
      input: { origin: 'TH', dest: 'DE' },
      duty: 'ok',
      vat: 'ok',
      surcharges: 'ok',
      freight: 'ok',
      fxMissingRate: false,
      strictStaleDuties: true,
      expectedOverall: 'missing',
      expectedMissing: ['duty'],
    },
  ])(
    'lane confidence: $name',
    async ({
      input,
      duty,
      vat,
      surcharges,
      freight,
      fxMissingRate,
      strictStaleDuties,
      expectedOverall,
      expectedMissing,
    }) => {
      mockMerchantContext(undefined, []);

      mocks.getActiveDutyRateWithMetaMock.mockResolvedValue({
        value:
          duty === 'ok'
            ? {
                ratePct: 5,
                source: 'official',
                effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
              }
            : null,
        meta: { status: duty, dataset: duty === 'ok' ? 'official' : null, effectiveFrom: null },
      });
      mocks.getVatForHs6WithMetaMock.mockResolvedValue({
        value:
          vat === 'ok'
            ? {
                ratePct: 20,
                vatBase: 'CIF_PLUS_DUTY',
                source: 'default',
                effectiveFrom: new Date('2025-01-02T00:00:00.000Z'),
              }
            : null,
        meta: { status: vat, dataset: null, effectiveFrom: null },
      });
      mocks.getSurchargesScopedWithMetaMock.mockResolvedValue({
        value: surcharges === 'ok' ? [{ fixedAmt: 5, pctAmt: 2 }] : [],
        meta: { status: surcharges, dataset: null, effectiveFrom: null },
      });
      mocks.getFreightWithMetaMock.mockResolvedValue({
        value: freight === 'ok' ? { price: 20 } : null,
        meta: { status: freight },
      });
      mocks.convertCurrencyWithMetaMock.mockImplementation(
        async (amount: number, from: string, to: string) => {
          const markMissing = fxMissingRate && from !== to;
          return { amount: Number(amount), meta: { missingRate: markMissing } };
        }
      );
      mocks.getDatasetFreshnessSnapshotMock.mockResolvedValueOnce({
        now: new Date('2025-01-01T00:00:00.000Z'),
        datasets: {
          duties: {
            scheduled: true,
            freshnessThresholdHours: 192,
            lastSuccessAt: strictStaleDuties ? null : new Date('2025-01-01T00:00:00.000Z'),
            lastAttemptAt: new Date('2025-01-01T00:00:00.000Z'),
            source: null,
            latestRunAt: strictStaleDuties ? null : new Date('2025-01-01T00:00:00.000Z'),
            ageHours: strictStaleDuties ? null : 0,
            stale: Boolean(strictStaleDuties),
          },
          vat: {
            scheduled: true,
            freshnessThresholdHours: 48,
            lastSuccessAt: new Date('2025-01-01T00:00:00.000Z'),
            lastAttemptAt: new Date('2025-01-01T00:00:00.000Z'),
            source: null,
            latestRunAt: new Date('2025-01-01T00:00:00.000Z'),
            ageHours: 0,
            stale: false,
          },
          'de-minimis': {
            scheduled: true,
            freshnessThresholdHours: 48,
            lastSuccessAt: new Date('2025-01-01T00:00:00.000Z'),
            lastAttemptAt: new Date('2025-01-01T00:00:00.000Z'),
            source: null,
            latestRunAt: new Date('2025-01-01T00:00:00.000Z'),
            ageHours: 0,
            stale: false,
          },
          surcharges: {
            scheduled: true,
            freshnessThresholdHours: 192,
            lastSuccessAt: new Date('2025-01-01T00:00:00.000Z'),
            lastAttemptAt: new Date('2025-01-01T00:00:00.000Z'),
            source: null,
            latestRunAt: new Date('2025-01-01T00:00:00.000Z'),
            ageHours: 0,
            stale: false,
          },
          'hs-aliases': {
            scheduled: true,
            freshnessThresholdHours: 192,
            lastSuccessAt: new Date('2025-01-01T00:00:00.000Z'),
            lastAttemptAt: new Date('2025-01-01T00:00:00.000Z'),
            source: null,
            latestRunAt: new Date('2025-01-01T00:00:00.000Z'),
            ageHours: 0,
            stale: false,
          },
          freight: {
            scheduled: false,
            freshnessThresholdHours: null,
            lastSuccessAt: null,
            lastAttemptAt: null,
            source: null,
            latestRunAt: null,
            ageHours: null,
            stale: null,
          },
          fx: {
            scheduled: true,
            freshnessThresholdHours: 30,
            lastSuccessAt: new Date('2025-01-01T00:00:00.000Z'),
            lastAttemptAt: new Date('2025-01-01T00:00:00.000Z'),
            source: null,
            latestRunAt: new Date('2025-01-01T00:00:00.000Z'),
            ageHours: 0,
            stale: false,
          },
          notices: {
            scheduled: true,
            freshnessThresholdHours: 48,
            lastSuccessAt: new Date('2025-01-01T00:00:00.000Z'),
            lastAttemptAt: new Date('2025-01-01T00:00:00.000Z'),
            source: null,
            latestRunAt: new Date('2025-01-01T00:00:00.000Z'),
            ageHours: 0,
            stale: false,
          },
        },
      });

      const out = await quoteLandedCost(
        { ...baseInput, ...input },
        strictStaleDuties ? { strictFreshness: true } : undefined
      );
      if (strictStaleDuties) {
        expect(mocks.getDatasetFreshnessSnapshotMock).toHaveBeenCalledTimes(1);
      }
      expect(out.quote.overallConfidence).toBe(expectedOverall);
      for (const component of expectedMissing) {
        expect(out.quote.missingComponents).toContain(component);
      }
    }
  );

  it('strict freshness mode marks stale required datasets as missing', async () => {
    mockMerchantContext(undefined, []);
    mocks.getDatasetFreshnessSnapshotMock.mockResolvedValueOnce({
      now: new Date('2025-01-01T00:00:00.000Z'),
      datasets: {
        duties: {
          scheduled: true,
          freshnessThresholdHours: 192,
          lastSuccessAt: null,
          lastAttemptAt: null,
          source: null,
          latestRunAt: null,
          ageHours: null,
          stale: true,
        },
        vat: {
          scheduled: true,
          freshnessThresholdHours: 48,
          lastSuccessAt: new Date('2025-01-01T00:00:00.000Z'),
          lastAttemptAt: new Date('2025-01-01T00:00:00.000Z'),
          source: null,
          latestRunAt: new Date('2025-01-01T00:00:00.000Z'),
          ageHours: 0,
          stale: false,
        },
        'de-minimis': {
          scheduled: true,
          freshnessThresholdHours: 48,
          lastSuccessAt: new Date('2025-01-01T00:00:00.000Z'),
          lastAttemptAt: new Date('2025-01-01T00:00:00.000Z'),
          source: null,
          latestRunAt: new Date('2025-01-01T00:00:00.000Z'),
          ageHours: 0,
          stale: false,
        },
        surcharges: {
          scheduled: true,
          freshnessThresholdHours: 192,
          lastSuccessAt: null,
          lastAttemptAt: null,
          source: null,
          latestRunAt: null,
          ageHours: null,
          stale: true,
        },
        'hs-aliases': {
          scheduled: true,
          freshnessThresholdHours: 192,
          lastSuccessAt: new Date('2025-01-01T00:00:00.000Z'),
          lastAttemptAt: new Date('2025-01-01T00:00:00.000Z'),
          source: null,
          latestRunAt: new Date('2025-01-01T00:00:00.000Z'),
          ageHours: 0,
          stale: false,
        },
        freight: {
          scheduled: false,
          freshnessThresholdHours: null,
          lastSuccessAt: null,
          lastAttemptAt: null,
          source: null,
          latestRunAt: null,
          ageHours: null,
          stale: null,
        },
        fx: {
          scheduled: true,
          freshnessThresholdHours: 30,
          lastSuccessAt: null,
          lastAttemptAt: null,
          source: null,
          latestRunAt: null,
          ageHours: null,
          stale: true,
        },
        notices: {
          scheduled: true,
          freshnessThresholdHours: 48,
          lastSuccessAt: new Date('2025-01-01T00:00:00.000Z'),
          lastAttemptAt: new Date('2025-01-01T00:00:00.000Z'),
          source: null,
          latestRunAt: new Date('2025-01-01T00:00:00.000Z'),
          ageHours: 0,
          stale: false,
        },
      },
    });

    const out = await quoteLandedCost(baseInput, { strictFreshness: true });
    expect(mocks.getDatasetFreshnessSnapshotMock).toHaveBeenCalledTimes(1);

    expect(out.quote.componentConfidence.duty).toBe('missing');
    expect(out.quote.componentConfidence.surcharges).toBe('missing');
    expect(out.quote.componentConfidence.fx).toBe('missing');
    expect(out.quote.missingComponents).toEqual(
      expect.arrayContaining(['duty', 'surcharges', 'fx'])
    );
    expect(out.quote.overallConfidence).toBe('missing');
    expect(out.quote.policy).toContain('Strict freshness mode');
  });
});
