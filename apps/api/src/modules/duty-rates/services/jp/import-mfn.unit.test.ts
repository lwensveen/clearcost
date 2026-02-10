import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DutyRateInsert } from '@clearcost/types';

const mocks = vi.hoisted(() => ({
  fetchJpMfnDutyRatesMock: vi.fn(),
  fetchWitsMfnDutyRatesMock: vi.fn(),
  batchUpsertDutyRatesFromStreamMock: vi.fn(),
}));

vi.mock('./fetch-mfn.js', () => ({
  fetchJpMfnDutyRates: mocks.fetchJpMfnDutyRatesMock,
}));

vi.mock('../wits/mfn.js', () => ({
  fetchWitsMfnDutyRates: mocks.fetchWitsMfnDutyRatesMock,
}));

vi.mock('../../utils/batch-upsert.js', () => ({
  batchUpsertDutyRatesFromStream: mocks.batchUpsertDutyRatesFromStreamMock,
}));

import { importJpMfn } from './import-mfn.js';

function makeRow(overrides: Partial<DutyRateInsert> = {}): DutyRateInsert {
  return {
    dest: 'JP',
    partner: '',
    hs6: '010121',
    source: 'official',
    ratePct: '5.000',
    dutyRule: 'mfn',
    currency: 'JPY',
    effectiveFrom: new Date('2025-04-01T00:00:00.000Z'),
    effectiveTo: null,
    notes: null,
    ...overrides,
  };
}

describe('importJpMfn', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.fetchJpMfnDutyRatesMock.mockResolvedValue([]);
    mocks.fetchWitsMfnDutyRatesMock.mockResolvedValue([]);
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      inserted: 0,
      updated: 0,
      count: 0,
      dryRun: false,
    });
  });

  it('throws when official and fallback sources both produce zero rows', async () => {
    await expect(importJpMfn({ useWitsFallback: true })).rejects.toThrow(
      /official and WITS fallback sources/i
    );
    expect(mocks.batchUpsertDutyRatesFromStreamMock).not.toHaveBeenCalled();
  });

  it('throws when official source produces zero rows and fallback is disabled', async () => {
    await expect(importJpMfn({})).rejects.toThrow(/produced 0 official rows/i);
    expect(mocks.fetchWitsMfnDutyRatesMock).not.toHaveBeenCalled();
    expect(mocks.batchUpsertDutyRatesFromStreamMock).not.toHaveBeenCalled();
  });

  it('merges official and WITS rows when fallback is enabled', async () => {
    const official = makeRow({ hs6: '010121', source: 'official' });
    const wits = makeRow({ hs6: '010129', source: 'wits', ratePct: '7.500', currency: 'USD' });
    mocks.fetchJpMfnDutyRatesMock.mockResolvedValue([official]);
    mocks.fetchWitsMfnDutyRatesMock.mockResolvedValue([wits]);
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
    });

    const out = await importJpMfn({ hs6List: ['010121', '010129'], useWitsFallback: true });

    expect(out).toMatchObject({ ok: true, inserted: 2, updated: 0, count: 2 });
    expect(mocks.fetchJpMfnDutyRatesMock).toHaveBeenCalledWith({ hs6List: ['010121', '010129'] });
    expect(mocks.fetchWitsMfnDutyRatesMock).toHaveBeenCalledWith({
      dest: 'JP',
      backfillYears: 1,
      hs6List: ['010121', '010129'],
    });
    expect(mocks.batchUpsertDutyRatesFromStreamMock).toHaveBeenCalledTimes(1);

    const [rows, options] = mocks.batchUpsertDutyRatesFromStreamMock.mock.calls[0] ?? [];
    expect(rows).toEqual([official, wits]);
    expect(options).not.toHaveProperty('source');
  });

  it('does not call WITS when fallback is disabled by default', async () => {
    const official = makeRow({ hs6: '020110', source: 'official' });
    mocks.fetchJpMfnDutyRatesMock.mockResolvedValue([official]);
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      inserted: 1,
      updated: 0,
      count: 1,
      dryRun: false,
    });

    const out = await importJpMfn({});

    expect(out).toMatchObject({ ok: true, inserted: 1, updated: 0, count: 1 });
    expect(mocks.fetchWitsMfnDutyRatesMock).not.toHaveBeenCalled();
    expect(mocks.batchUpsertDutyRatesFromStreamMock).toHaveBeenCalledWith(
      [official],
      expect.objectContaining({
        makeSourceRef: expect.any(Function),
      })
    );
  });

  it('builds source refs that preserve official vs fallback provenance', async () => {
    const official = makeRow({ source: 'official', hs6: '010121' });
    const wits = makeRow({
      source: 'wits',
      hs6: '020110',
      partner: 'AU',
      dutyRule: 'fta',
    });
    mocks.fetchJpMfnDutyRatesMock.mockResolvedValue([official]);
    mocks.fetchWitsMfnDutyRatesMock.mockResolvedValue([wits]);
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
    });

    await importJpMfn({ useWitsFallback: true });

    const [, options] = mocks.batchUpsertDutyRatesFromStreamMock.mock.calls[0] ?? [];
    const makeSourceRef = options?.makeSourceRef as ((row: DutyRateInsert) => string) | undefined;
    expect(makeSourceRef).toBeTypeOf('function');
    expect(makeSourceRef?.(official)).toBe('jp-customs:JP:ERGA:mfn:010121');
    expect(makeSourceRef?.(wits)).toBe('wits:JP:AU:fta:020110');
  });
});
