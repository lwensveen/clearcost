import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getLatestVersionIdFromBaseMock: vi.fn(),
  s3SelectMock: vi.fn(),
  resolveUkTariffDutySourceUrlsMock: vi.fn(),
  batchUpsertSurchargesFromStreamMock: vi.fn(),
}));

vi.mock('../../../duty-rates/services/uk/base.js', async () => {
  const actual = await vi.importActual<typeof import('../../../duty-rates/services/uk/base.js')>(
    '../../../duty-rates/services/uk/base.js'
  );
  return {
    ...actual,
    getLatestVersionIdFromBase: mocks.getLatestVersionIdFromBaseMock,
    s3Select: mocks.s3SelectMock,
  };
});

vi.mock('../../../duty-rates/services/uk/source-urls.js', () => ({
  resolveUkTariffDutySourceUrls: mocks.resolveUkTariffDutySourceUrlsMock,
}));

vi.mock('../../utils/batch-upsert.js', () => ({
  batchUpsertSurchargesFromStream: mocks.batchUpsertSurchargesFromStreamMock,
}));

import { importUkTradeRemediesAsSurcharges } from './import-remedies.js';

describe('importUkTradeRemediesAsSurcharges', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getLatestVersionIdFromBaseMock.mockResolvedValue('v1.0.0');
    mocks.resolveUkTariffDutySourceUrlsMock.mockResolvedValue({
      apiBaseUrl: 'https://data.api.trade.gov.uk',
    });
    mocks.s3SelectMock.mockResolvedValue([
      {
        commodity__code: '1234567890',
        measure__type__id: '552',
        geographical_area__id: 'CN',
        geographical_area__description: 'China',
        duty_rate: '25%',
        validity_start_date: '2025-01-01',
      },
    ]);
    mocks.batchUpsertSurchargesFromStreamMock.mockResolvedValue({
      ok: true,
      inserted: 1,
      updated: 0,
      count: 1,
    });
  });

  it('writes pctAmt as ad-valorem fraction (0..1) for UK remedy rows', async () => {
    const out = await importUkTradeRemediesAsSurcharges({
      measureTypeIds: ['552'],
      importId: 'imp_1',
    });

    expect(out).toEqual({ ok: true, count: 1 });
    expect(mocks.batchUpsertSurchargesFromStreamMock).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          dest: 'GB',
          origin: 'CN',
          hs6: '123456',
          surchargeCode: 'ANTIDUMPING',
          pctAmt: '0.250000',
        }),
      ],
      expect.objectContaining({
        importId: 'imp_1',
      })
    );
  });

  it('fails fast when source parsing yields zero remedy rows', async () => {
    mocks.s3SelectMock.mockResolvedValueOnce([]);

    await expect(
      importUkTradeRemediesAsSurcharges({
        measureTypeIds: ['552'],
      })
    ).rejects.toThrow(/produced 0 rows/i);
  });
});
