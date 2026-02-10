import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DutyRateInsert } from '@clearcost/types';

const mocks = vi.hoisted(() => ({
  fetchWitsPreferentialDutyRatesMock: vi.fn(),
  batchUpsertDutyRatesFromStreamMock: vi.fn(),
}));

vi.mock('../wits/preferential.js', () => ({
  fetchWitsPreferentialDutyRates: mocks.fetchWitsPreferentialDutyRatesMock,
}));

vi.mock('../../utils/batch-upsert.js', () => ({
  batchUpsertDutyRatesFromStream: mocks.batchUpsertDutyRatesFromStreamMock,
}));

import { importJpPreferential, JP_FTA_DEFAULT_PARTNER_GEOIDS } from './import-preferential.js';

function makeRow(overrides: Partial<DutyRateInsert> = {}): DutyRateInsert {
  return {
    dest: 'JP',
    partner: 'AU',
    hs6: '010121',
    source: 'wits',
    ratePct: '2.000',
    dutyRule: 'fta',
    currency: 'USD',
    effectiveFrom: new Date('2025-04-01T00:00:00.000Z'),
    effectiveTo: null,
    notes: null,
    ...overrides,
  };
}

describe('importJpPreferential', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.fetchWitsPreferentialDutyRatesMock.mockResolvedValue([]);
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      inserted: 0,
      updated: 0,
      count: 0,
      dryRun: false,
    });
  });

  it('uses default partner coverage when partners are omitted', async () => {
    mocks.fetchWitsPreferentialDutyRatesMock.mockImplementation(async ({ partner }) => [
      makeRow({ partner }),
    ]);
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      inserted: JP_FTA_DEFAULT_PARTNER_GEOIDS.length,
      updated: 0,
      count: JP_FTA_DEFAULT_PARTNER_GEOIDS.length,
      dryRun: false,
    });

    const out = await importJpPreferential({});

    expect(out).toMatchObject({
      ok: true,
      inserted: JP_FTA_DEFAULT_PARTNER_GEOIDS.length,
      count: JP_FTA_DEFAULT_PARTNER_GEOIDS.length,
    });
    expect(mocks.fetchWitsPreferentialDutyRatesMock).toHaveBeenCalledTimes(
      JP_FTA_DEFAULT_PARTNER_GEOIDS.length
    );
    expect(mocks.fetchWitsPreferentialDutyRatesMock).toHaveBeenNthCalledWith(1, {
      dest: 'JP',
      partner: JP_FTA_DEFAULT_PARTNER_GEOIDS[0],
      backfillYears: 1,
      hs6List: undefined,
    });
    const [rows] = mocks.batchUpsertDutyRatesFromStreamMock.mock.calls[0] ?? [];
    expect(rows).toHaveLength(JP_FTA_DEFAULT_PARTNER_GEOIDS.length);
  });

  it('uses default partner coverage when an explicit empty partner list is provided', async () => {
    mocks.fetchWitsPreferentialDutyRatesMock.mockImplementation(async ({ partner }) => [
      makeRow({ partner }),
    ]);
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      inserted: JP_FTA_DEFAULT_PARTNER_GEOIDS.length,
      updated: 0,
      count: JP_FTA_DEFAULT_PARTNER_GEOIDS.length,
      dryRun: false,
    });

    await importJpPreferential({ partnerGeoIds: [] });

    expect(mocks.fetchWitsPreferentialDutyRatesMock).toHaveBeenCalledTimes(
      JP_FTA_DEFAULT_PARTNER_GEOIDS.length
    );
  });

  it('normalizes and de-duplicates partner inputs before fallback fetches', async () => {
    mocks.fetchWitsPreferentialDutyRatesMock.mockImplementation(async ({ partner }) => [
      makeRow({ partner }),
    ]);
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
    });

    await importJpPreferential({ partnerGeoIds: ['au', 'AU', 'eu', 'invalid', ''] });

    expect(mocks.fetchWitsPreferentialDutyRatesMock).toHaveBeenCalledTimes(2);
    expect(mocks.fetchWitsPreferentialDutyRatesMock).toHaveBeenNthCalledWith(1, {
      dest: 'JP',
      partner: 'AU',
      backfillYears: 1,
      hs6List: undefined,
    });
    expect(mocks.fetchWitsPreferentialDutyRatesMock).toHaveBeenNthCalledWith(2, {
      dest: 'JP',
      partner: 'EU',
      backfillYears: 1,
      hs6List: undefined,
    });
  });

  it('throws when official and fallback sources both produce zero rows', async () => {
    await expect(
      importJpPreferential({ partnerGeoIds: ['AU'], useWitsFallback: true })
    ).rejects.toThrow(/official and WITS fallback sources/i);
    expect(mocks.batchUpsertDutyRatesFromStreamMock).not.toHaveBeenCalled();
  });

  it('throws when fallback is disabled and official source has no rows', async () => {
    await expect(importJpPreferential({ useWitsFallback: false })).rejects.toThrow(
      /produced 0 official rows/i
    );
    expect(mocks.fetchWitsPreferentialDutyRatesMock).not.toHaveBeenCalled();
    expect(mocks.batchUpsertDutyRatesFromStreamMock).not.toHaveBeenCalled();
  });

  it('keeps per-row source provenance in refs and does not force source=wits', async () => {
    const row = makeRow({ partner: 'AU', hs6: '020110', source: 'wits' });
    mocks.fetchWitsPreferentialDutyRatesMock.mockResolvedValue([row]);
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      inserted: 1,
      updated: 0,
      count: 1,
      dryRun: false,
    });

    await importJpPreferential({ partnerGeoIds: ['AU'], useWitsFallback: true });

    const [, options] = mocks.batchUpsertDutyRatesFromStreamMock.mock.calls[0] ?? [];
    expect(options).not.toHaveProperty('source');
    const makeSourceRef = options?.makeSourceRef as ((r: DutyRateInsert) => string) | undefined;
    expect(makeSourceRef).toBeTypeOf('function');
    expect(makeSourceRef?.(row)).toBe('wits:JP:AU:fta:020110');
  });
});
