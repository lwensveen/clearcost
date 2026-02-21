import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DutyRateInsert } from '@clearcost/types';

const mocks = vi.hoisted(() => ({
  resolveCnPreferentialDutySourceUrlsMock: vi.fn(),
  fetchCnPreferentialDutyRatesMock: vi.fn(),
  fetchWitsPreferentialDutyRatesMock: vi.fn(),
  batchUpsertDutyRatesFromStreamMock: vi.fn(),
}));

vi.mock('./source-urls.js', () => ({
  resolveCnPreferentialDutySourceUrls: mocks.resolveCnPreferentialDutySourceUrlsMock,
}));

vi.mock('./fetch-preferential.js', () => ({
  fetchCnPreferentialDutyRates: mocks.fetchCnPreferentialDutyRatesMock,
}));

vi.mock('../wits/preferential.js', () => ({
  fetchWitsPreferentialDutyRates: mocks.fetchWitsPreferentialDutyRatesMock,
}));

vi.mock('../../utils/batch-upsert.js', () => ({
  batchUpsertDutyRatesFromStream: mocks.batchUpsertDutyRatesFromStreamMock,
}));

import {
  CN_FTA_DEFAULT_PARTNER_GEOIDS,
  importCnPreferential,
  importCnPreferentialFromWits,
} from './import-preferential.js';

function makeRow(overrides: Partial<DutyRateInsert> = {}): DutyRateInsert {
  return {
    dest: 'CN',
    partner: 'AU',
    hs6: '850440',
    source: 'official',
    ratePct: '2.000',
    dutyRule: 'fta',
    currency: 'USD',
    effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
    effectiveTo: null,
    notes: null,
    ...overrides,
  };
}

describe('importCnPreferential', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.resolveCnPreferentialDutySourceUrlsMock.mockResolvedValue({
      ftaExcelUrl: 'https://official.test/cn-fta.xlsx',
    });
    mocks.fetchCnPreferentialDutyRatesMock.mockResolvedValue([]);
    mocks.fetchWitsPreferentialDutyRatesMock.mockResolvedValue([]);
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      inserted: 0,
      updated: 0,
      count: 0,
      dryRun: false,
    });
  });

  it('uses default partner coverage when partners are omitted', async () => {
    mocks.fetchCnPreferentialDutyRatesMock.mockResolvedValue(
      CN_FTA_DEFAULT_PARTNER_GEOIDS.map((partner) => makeRow({ partner, source: 'official' }))
    );
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      inserted: CN_FTA_DEFAULT_PARTNER_GEOIDS.length,
      updated: 0,
      count: CN_FTA_DEFAULT_PARTNER_GEOIDS.length,
      dryRun: false,
    });

    const out = await importCnPreferential({});

    expect(out).toMatchObject({
      ok: true,
      inserted: CN_FTA_DEFAULT_PARTNER_GEOIDS.length,
      count: CN_FTA_DEFAULT_PARTNER_GEOIDS.length,
    });
    expect(mocks.fetchCnPreferentialDutyRatesMock).toHaveBeenCalledWith({
      urlOrPath: 'https://official.test/cn-fta.xlsx',
      sheet: undefined,
      hs6List: undefined,
      partnerGeoIds: [...CN_FTA_DEFAULT_PARTNER_GEOIDS],
    });
    expect(mocks.fetchWitsPreferentialDutyRatesMock).not.toHaveBeenCalled();
  });

  it('falls back to WITS only for partners missing in official output', async () => {
    mocks.fetchCnPreferentialDutyRatesMock.mockResolvedValue([makeRow({ partner: 'AU' })]);
    mocks.fetchWitsPreferentialDutyRatesMock.mockResolvedValue([
      makeRow({ partner: 'KR', source: 'wits' }),
    ]);
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
    });

    await importCnPreferential({ partnerGeoIds: ['AU', 'KR'] });

    expect(mocks.fetchWitsPreferentialDutyRatesMock).toHaveBeenCalledTimes(1);
    expect(mocks.fetchWitsPreferentialDutyRatesMock).toHaveBeenCalledWith({
      dest: 'CN',
      partner: 'KR',
      backfillYears: 1,
      hs6List: undefined,
    });
    const [rows] = mocks.batchUpsertDutyRatesFromStreamMock.mock.calls[0] ?? [];
    expect(rows).toHaveLength(2);
  });

  it('uses WITS fallback when official source URL is missing', async () => {
    mocks.resolveCnPreferentialDutySourceUrlsMock.mockResolvedValue({ ftaExcelUrl: undefined });
    mocks.fetchWitsPreferentialDutyRatesMock.mockResolvedValue([
      makeRow({ partner: 'AU', source: 'wits' }),
    ]);
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      inserted: 1,
      updated: 0,
      count: 1,
      dryRun: false,
    });

    const out = await importCnPreferential({ partnerGeoIds: ['AU'] });

    expect(out).toMatchObject({ ok: true, inserted: 1, count: 1 });
    expect(mocks.fetchCnPreferentialDutyRatesMock).not.toHaveBeenCalled();
    expect(mocks.fetchWitsPreferentialDutyRatesMock).toHaveBeenCalledTimes(1);
  });

  it('throws when official-only mode has no configured source URL', async () => {
    mocks.resolveCnPreferentialDutySourceUrlsMock.mockResolvedValue({ ftaExcelUrl: undefined });

    await expect(
      importCnPreferential({ partnerGeoIds: ['AU'], useWitsFallback: false })
    ).rejects.toThrow(/official source URL is not configured/i);
    expect(mocks.fetchWitsPreferentialDutyRatesMock).not.toHaveBeenCalled();
    expect(mocks.batchUpsertDutyRatesFromStreamMock).not.toHaveBeenCalled();
  });

  it('keeps source-aware provenance refs for mixed official+WITS rows', async () => {
    const officialRow = makeRow({ partner: 'AU', source: 'official' });
    const witsRow = makeRow({ partner: 'KR', source: 'wits' });

    mocks.fetchCnPreferentialDutyRatesMock.mockResolvedValue([officialRow]);
    mocks.fetchWitsPreferentialDutyRatesMock.mockResolvedValue([witsRow]);
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
    });

    await importCnPreferential({ partnerGeoIds: ['AU', 'KR'] });

    const [, options] = mocks.batchUpsertDutyRatesFromStreamMock.mock.calls[0] ?? [];
    const makeSourceRef = options?.makeSourceRef as ((r: DutyRateInsert) => string) | undefined;
    expect(makeSourceRef).toBeTypeOf('function');
    expect(makeSourceRef?.(officialRow)).toBe('cn-official:CN:AU:fta:850440');
    expect(makeSourceRef?.(witsRow)).toBe('wits:CN:KR:fta:850440');
  });

  it('supports explicit WITS-only importer path', async () => {
    mocks.fetchWitsPreferentialDutyRatesMock.mockResolvedValue([
      makeRow({ partner: 'AU', source: 'wits' }),
    ]);
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      inserted: 1,
      updated: 0,
      count: 1,
      dryRun: false,
    });

    const out = await importCnPreferentialFromWits({ partnerGeoIds: ['AU'] });

    expect(out).toMatchObject({ ok: true, inserted: 1, count: 1 });
    expect(mocks.fetchCnPreferentialDutyRatesMock).not.toHaveBeenCalled();
    expect(mocks.fetchWitsPreferentialDutyRatesMock).toHaveBeenCalledWith({
      dest: 'CN',
      partner: 'AU',
      backfillYears: 1,
      hs6List: undefined,
    });
  });
});
