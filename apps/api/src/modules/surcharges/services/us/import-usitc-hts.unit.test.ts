import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exportChapterJsonMock: vi.fn(),
  parseHts10Mock: vi.fn(),
  hasCompoundMock: vi.fn(),
  batchUpsertSurchargesFromStreamMock: vi.fn(),
}));

vi.mock('../../../duty-rates/services/us/hts-base.js', () => ({
  exportChapterJson: mocks.exportChapterJsonMock,
  parseHts10: mocks.parseHts10Mock,
  hasCompound: mocks.hasCompoundMock,
}));

vi.mock('../../utils/batch-upsert.js', () => ({
  batchUpsertSurchargesFromStream: mocks.batchUpsertSurchargesFromStreamMock,
}));

import { importUsTradeRemediesFromHTS } from './import-usitc-hts.js';

describe('importUsTradeRemediesFromHTS', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.exportChapterJsonMock.mockResolvedValue([]);
    mocks.parseHts10Mock.mockImplementation((row: Record<string, unknown>) => row.hts10 ?? null);
    mocks.hasCompoundMock.mockReturnValue(false);
    mocks.batchUpsertSurchargesFromStreamMock.mockResolvedValue({
      inserted: 1,
      updated: 0,
      count: 1,
    });
  });

  it('imports chapter-99 remedy rows with program applyLevel and aggregate source refs', async () => {
    mocks.exportChapterJsonMock.mockResolvedValue([
      { hts10: '9903.88.03', column1General: '25%' },
      { hts10: '9903.80.01', column1General: '10%' },
    ]);
    mocks.batchUpsertSurchargesFromStreamMock.mockResolvedValue({
      inserted: 2,
      updated: 0,
      count: 2,
    });

    const out = await importUsTradeRemediesFromHTS({
      effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
    });

    expect(out).toMatchObject({ ok: true, inserted: 2, updated: 0, count: 2 });
    expect(mocks.exportChapterJsonMock).toHaveBeenCalledWith(99);
    expect(mocks.batchUpsertSurchargesFromStreamMock).toHaveBeenCalledTimes(1);

    const [rows, options] = mocks.batchUpsertSurchargesFromStreamMock.mock.calls[0] ?? [];
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          surchargeCode: 'TRADE_REMEDY_301',
          origin: 'CN',
          hs6: null,
          applyLevel: 'program',
          pctAmt: '0.250000',
        }),
        expect.objectContaining({
          surchargeCode: 'TRADE_REMEDY_232',
          origin: null,
          hs6: null,
          applyLevel: 'program',
          pctAmt: '0.100000',
        }),
      ])
    );
    expect(String(rows[0]?.notes ?? '')).toContain('requires HS6 correlation');
    expect(options.makeSourceRef(rows[0])).toContain('scope=aggregate');
  });

  it('throws when no parseable remedy rows are found', async () => {
    mocks.exportChapterJsonMock.mockResolvedValue([
      { hts10: '9903.88.03', column1General: 'Free' },
    ]);

    await expect(importUsTradeRemediesFromHTS({ skipFree: true })).rejects.toThrow(
      /produced 0 rows/i
    );
    expect(mocks.batchUpsertSurchargesFromStreamMock).not.toHaveBeenCalled();
  });
});
