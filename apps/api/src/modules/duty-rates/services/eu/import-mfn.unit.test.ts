import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DutyRateInsert } from '@clearcost/types';

const mocks = vi.hoisted(() => ({
  fetchEuMfnDutyRatesMock: vi.fn(),
  batchUpsertDutyRatesFromStreamMock: vi.fn(),
}));

vi.mock('./fetch-mfn.js', () => ({
  fetchEuMfnDutyRates: mocks.fetchEuMfnDutyRatesMock,
}));

vi.mock('../../utils/batch-upsert.js', () => ({
  batchUpsertDutyRatesFromStream: mocks.batchUpsertDutyRatesFromStreamMock,
}));

import { importEuMfn } from './import-mfn.js';

function makeRow(overrides: Partial<DutyRateInsert> = {}): DutyRateInsert {
  return {
    dest: 'EU',
    partner: '',
    hs6: '010121',
    source: 'official',
    ratePct: '5.000',
    dutyRule: 'mfn',
    currency: 'EUR',
    effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
    effectiveTo: null,
    notes: 'EU MFN ad-valorem (TARIC).',
    ...overrides,
  };
}

describe('importEuMfn', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.fetchEuMfnDutyRatesMock.mockResolvedValue([]);
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      inserted: 0,
      updated: 0,
      count: 0,
      dryRun: false,
    });
  });

  it('throws when the fetcher returns zero rows', async () => {
    await expect(importEuMfn({})).rejects.toThrow(/produced 0 rows/i);
    expect(mocks.batchUpsertDutyRatesFromStreamMock).not.toHaveBeenCalled();
  });

  it('upserts TARIC rows as official with taric source refs', async () => {
    const row = makeRow();
    mocks.fetchEuMfnDutyRatesMock.mockResolvedValue([row]);
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      inserted: 1,
      updated: 0,
      count: 1,
      dryRun: false,
    });

    const out = await importEuMfn({
      hs6List: ['010121'],
      importId: 'run_123',
      batchSize: 1000,
    });

    expect(out).toMatchObject({ ok: true, inserted: 1, updated: 0, count: 1, dryRun: false });
    expect(mocks.fetchEuMfnDutyRatesMock).toHaveBeenCalledWith({
      hs6List: ['010121'],
      xmlMeasureUrl: undefined,
      xmlComponentUrl: undefined,
      xmlDutyExprUrl: undefined,
      language: undefined,
    });

    const [rows, options] = mocks.batchUpsertDutyRatesFromStreamMock.mock.calls[0] ?? [];
    expect(rows).toEqual([row]);
    expect(options).toMatchObject({
      batchSize: 1000,
      importId: 'run_123',
      source: 'official',
    });
    expect(options.makeSourceRef(row)).toBe('taric:mfn:010121');
  });
});
