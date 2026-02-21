import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DutyRateInsert } from '@clearcost/types';

const mocks = vi.hoisted(() => ({
  fetchJpPreferentialDutyRatesMock: vi.fn(),
  fetchWitsPreferentialDutyRatesMock: vi.fn(),
  batchUpsertDutyRatesFromStreamMock: vi.fn(),
}));

vi.mock('./fetch-preferential.js', () => ({
  fetchJpPreferentialDutyRates: mocks.fetchJpPreferentialDutyRatesMock,
}));

vi.mock('../wits/preferential.js', () => ({
  fetchWitsPreferentialDutyRates: mocks.fetchWitsPreferentialDutyRatesMock,
}));

vi.mock('../../utils/batch-upsert.js', () => ({
  batchUpsertDutyRatesFromStream: mocks.batchUpsertDutyRatesFromStreamMock,
}));

import {
  importJpPreferential,
  importJpPreferentialFromWits,
  JP_FTA_DEFAULT_PARTNER_GEOIDS,
} from './import-preferential.js';

function makeRow(overrides: Partial<DutyRateInsert> = {}): DutyRateInsert {
  return {
    dest: 'JP',
    partner: 'AU',
    hs6: '010121',
    source: 'official',
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
    mocks.fetchJpPreferentialDutyRatesMock.mockResolvedValue([]);
    mocks.fetchWitsPreferentialDutyRatesMock.mockResolvedValue([]);
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      inserted: 0,
      updated: 0,
      count: 0,
      dryRun: false,
    });
  });

  it('uses default partner coverage for official fetch when partners are omitted', async () => {
    mocks.fetchJpPreferentialDutyRatesMock.mockResolvedValue(
      JP_FTA_DEFAULT_PARTNER_GEOIDS.map((partner) => makeRow({ partner, source: 'official' }))
    );
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
    expect(mocks.fetchJpPreferentialDutyRatesMock).toHaveBeenCalledWith({
      hs6List: undefined,
      partnerGeoIds: [...JP_FTA_DEFAULT_PARTNER_GEOIDS],
    });
    const [rows] = mocks.batchUpsertDutyRatesFromStreamMock.mock.calls[0] ?? [];
    expect(rows).toHaveLength(JP_FTA_DEFAULT_PARTNER_GEOIDS.length);
    expect(mocks.fetchWitsPreferentialDutyRatesMock).not.toHaveBeenCalled();
  });

  it('falls back to WITS for partners missing in official output', async () => {
    mocks.fetchJpPreferentialDutyRatesMock.mockResolvedValue([makeRow({ partner: 'AU' })]);
    mocks.fetchWitsPreferentialDutyRatesMock.mockImplementation(async ({ partner }) => [
      makeRow({ partner, source: 'wits' }),
    ]);
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
    });

    await importJpPreferential({ partnerGeoIds: ['AU', 'US'] });

    expect(mocks.fetchWitsPreferentialDutyRatesMock).toHaveBeenCalledTimes(1);
    expect(mocks.fetchWitsPreferentialDutyRatesMock).toHaveBeenCalledWith({
      dest: 'JP',
      partner: 'US',
      backfillYears: 1,
      hs6List: undefined,
    });
    const [rows] = mocks.batchUpsertDutyRatesFromStreamMock.mock.calls[0] ?? [];
    expect(rows).toHaveLength(2);
  });

  it('normalizes and de-duplicates partner inputs before fallback fetches', async () => {
    mocks.fetchJpPreferentialDutyRatesMock.mockResolvedValue([]);
    mocks.fetchWitsPreferentialDutyRatesMock.mockImplementation(async ({ partner }) => [
      makeRow({ partner, source: 'wits' }),
    ]);
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
    });

    await importJpPreferential({
      partnerGeoIds: ['au', 'AU', 'eu', 'invalid', ''],
      hs6List: ['010121'],
    });

    expect(mocks.fetchWitsPreferentialDutyRatesMock).toHaveBeenCalledTimes(2);
    expect(mocks.fetchWitsPreferentialDutyRatesMock).toHaveBeenNthCalledWith(1, {
      dest: 'JP',
      partner: 'AU',
      backfillYears: 1,
      hs6List: ['010121'],
    });
    expect(mocks.fetchWitsPreferentialDutyRatesMock).toHaveBeenNthCalledWith(2, {
      dest: 'JP',
      partner: 'EU',
      backfillYears: 1,
      hs6List: ['010121'],
    });
  });

  it('throws when both official and fallback sources produce zero rows', async () => {
    await expect(
      importJpPreferential({ partnerGeoIds: ['AU'], useWitsFallback: true })
    ).rejects.toThrow(/0 rows from official and WITS sources/i);
    expect(mocks.batchUpsertDutyRatesFromStreamMock).not.toHaveBeenCalled();
  });

  it('throws when official source produces zero rows and fallback is disabled', async () => {
    await expect(
      importJpPreferential({ partnerGeoIds: ['AU'], useWitsFallback: false })
    ).rejects.toThrow(/0 rows from official source/i);
    expect(mocks.fetchWitsPreferentialDutyRatesMock).not.toHaveBeenCalled();
    expect(mocks.batchUpsertDutyRatesFromStreamMock).not.toHaveBeenCalled();
  });

  it('keeps source-aware provenance refs for mixed official+WITS rows', async () => {
    const officialRow = makeRow({ partner: 'AU', hs6: '020110', source: 'official' });
    const witsRow = makeRow({ partner: 'US', hs6: '020110', source: 'wits' });
    mocks.fetchJpPreferentialDutyRatesMock.mockResolvedValue([officialRow]);
    mocks.fetchWitsPreferentialDutyRatesMock.mockResolvedValue([witsRow]);
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
    });

    await importJpPreferential({ partnerGeoIds: ['AU', 'US'], useWitsFallback: true });

    const [, options] = mocks.batchUpsertDutyRatesFromStreamMock.mock.calls[0] ?? [];
    expect(options).not.toHaveProperty('source');
    const makeSourceRef = options?.makeSourceRef as ((r: DutyRateInsert) => string) | undefined;
    expect(makeSourceRef).toBeTypeOf('function');
    expect(makeSourceRef?.(officialRow)).toBe('jp-customs:JP:AU:fta:020110');
    expect(makeSourceRef?.(witsRow)).toBe('wits:JP:US:fta:020110');
  });

  it('supports explicit WITS-only importer path', async () => {
    const witsRow = makeRow({ partner: 'AU', source: 'wits' });
    mocks.fetchWitsPreferentialDutyRatesMock.mockResolvedValue([witsRow]);
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      inserted: 1,
      updated: 0,
      count: 1,
      dryRun: false,
    });

    const out = await importJpPreferentialFromWits({ partnerGeoIds: ['AU'] });

    expect(out).toMatchObject({ ok: true, inserted: 1, count: 1 });
    expect(mocks.fetchJpPreferentialDutyRatesMock).not.toHaveBeenCalled();
    expect(mocks.fetchWitsPreferentialDutyRatesMock).toHaveBeenCalledWith({
      dest: 'JP',
      partner: 'AU',
      backfillYears: 1,
      hs6List: undefined,
    });
  });
});
