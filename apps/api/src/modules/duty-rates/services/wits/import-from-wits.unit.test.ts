import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DutyRateInsert } from '@clearcost/types';

const mocks = vi.hoisted(() => ({
  fetchWitsMfnDutyRatesMock: vi.fn(),
  fetchWitsPreferentialDutyRatesMock: vi.fn(),
  batchUpsertDutyRatesFromStreamMock: vi.fn(),
}));

vi.mock('./mfn.js', () => ({
  fetchWitsMfnDutyRates: mocks.fetchWitsMfnDutyRatesMock,
}));

vi.mock('./preferential.js', () => ({
  fetchWitsPreferentialDutyRates: mocks.fetchWitsPreferentialDutyRatesMock,
}));

vi.mock('../../utils/batch-upsert.js', () => ({
  batchUpsertDutyRatesFromStream: mocks.batchUpsertDutyRatesFromStreamMock,
}));

import { importDutyRatesFromWITS } from './import-from-wits.js';

function makeRow(overrides: Partial<DutyRateInsert> = {}): DutyRateInsert {
  return {
    dest: 'US',
    partner: '',
    hs6: '010121',
    source: 'wits',
    ratePct: '5.000',
    dutyRule: 'mfn',
    currency: 'USD',
    effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
    effectiveTo: null,
    notes: null,
    ...overrides,
  };
}

describe('importDutyRatesFromWITS', () => {
  const baseParams = {
    dests: ['US'],
    partners: [],
    backfillYears: 1,
    concurrency: 1,
    batchSize: 5000,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.fetchWitsMfnDutyRatesMock.mockResolvedValue([]);
    mocks.fetchWitsPreferentialDutyRatesMock.mockResolvedValue([]);
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      inserted: 0,
      updated: 0,
      count: 0,
    });
  });

  it('throws when all jobs produce zero source rows', async () => {
    await expect(
      importDutyRatesFromWITS({
        ...baseParams,
      })
    ).rejects.toThrow(/source produced 0 rows/i);

    expect(mocks.batchUpsertDutyRatesFromStreamMock).not.toHaveBeenCalled();
  });

  it('succeeds when rows are fetched even if upsert changes zero rows', async () => {
    mocks.fetchWitsMfnDutyRatesMock.mockResolvedValue([makeRow()]);

    const out = await importDutyRatesFromWITS({
      ...baseParams,
    });

    expect(out).toMatchObject({
      ok: true,
      inserted: 0,
      fetchedRows: 1,
      failedJobs: 0,
      totalJobs: 1,
    });
    expect(mocks.batchUpsertDutyRatesFromStreamMock).toHaveBeenCalledTimes(1);
  });

  it('records failed jobs but does not fail when at least one source job yields rows', async () => {
    mocks.fetchWitsMfnDutyRatesMock.mockResolvedValue([makeRow()]);
    mocks.fetchWitsPreferentialDutyRatesMock.mockRejectedValue(new Error('HTTP 503'));
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      inserted: 1,
      updated: 0,
      count: 1,
    });

    const out = await importDutyRatesFromWITS({
      ...baseParams,
      partners: ['CA'],
    });

    expect(out).toMatchObject({
      ok: true,
      inserted: 1,
      fetchedRows: 1,
      failedJobs: 1,
      totalJobs: 2,
    });
  });
});
