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

import { importMfnFromWits } from './import-mfn.js';
import { importPreferentialFromWits } from './import-preferential.js';

function makeRow(overrides: Partial<DutyRateInsert> = {}): DutyRateInsert {
  return {
    dest: 'JP',
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

describe('WITS single-lane importers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.fetchWitsMfnDutyRatesMock.mockResolvedValue([]);
    mocks.fetchWitsPreferentialDutyRatesMock.mockResolvedValue([]);
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      inserted: 1,
      updated: 0,
      count: 1,
      dryRun: false,
    });
  });

  it('throws when MFN fetch yields zero rows', async () => {
    await expect(importMfnFromWits({ dest: 'JP' })).rejects.toThrow(/produced 0 rows/i);
    expect(mocks.batchUpsertDutyRatesFromStreamMock).not.toHaveBeenCalled();
  });

  it('throws when preferential fetch yields zero rows across partners', async () => {
    await expect(
      importPreferentialFromWits({
        dest: 'JP',
        partnerGeoIds: ['CN', 'KR'],
      })
    ).rejects.toThrow(/produced 0 rows across 2 partner jobs/i);
    expect(mocks.batchUpsertDutyRatesFromStreamMock).not.toHaveBeenCalled();
  });

  it('allows preferential import when at least one partner yields rows', async () => {
    mocks.fetchWitsPreferentialDutyRatesMock.mockImplementation(
      async (args: { partner: string }) =>
        args.partner === 'CN' ? [makeRow({ partner: 'CN', dutyRule: 'fta' })] : []
    );

    const out = await importPreferentialFromWits({
      dest: 'JP',
      partnerGeoIds: ['CN', 'KR'],
    });

    expect(out).toMatchObject({ ok: true, inserted: 1, updated: 0, count: 1 });
    expect(mocks.batchUpsertDutyRatesFromStreamMock).toHaveBeenCalledTimes(1);
  });
});
