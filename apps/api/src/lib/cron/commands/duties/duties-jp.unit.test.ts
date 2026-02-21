import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  importJpMfnMock: vi.fn(),
  importJpPreferentialMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/jp/import-mfn.js', () => ({
  importJpMfn: mocks.importJpMfnMock,
}));

vi.mock('../../../../modules/duty-rates/services/jp/import-preferential.js', () => ({
  importJpPreferential: mocks.importJpPreferentialMock,
}));

import { dutiesJpAll, dutiesJpFta } from './duties-jp.js';

describe('duties-jp commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.importJpMfnMock.mockResolvedValue({ ok: true, inserted: 1, updated: 0, count: 1 });
    mocks.importJpPreferentialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
    });
  });

  it('forces strict official mode on import:duties:jp-fta', async () => {
    await dutiesJpFta(['--partners=US,AU', '--hs6=850440', '--dryRun=1']);

    expect(mocks.importJpPreferentialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hs6List: ['850440'],
        partnerGeoIds: ['US', 'AU'],
        dryRun: true,
        strictOfficial: true,
        useWitsFallback: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx?.params?.strictOfficial).toBe('1');
  });

  it('forces strict official mode on the FTA step of import:duties:jp-all', async () => {
    await dutiesJpAll(['--partners=US', '--hs6=850440']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    expect(mocks.importJpMfnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hs6List: ['850440'],
        dryRun: false,
        importId: 'run-123',
      })
    );
    expect(mocks.importJpPreferentialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hs6List: ['850440'],
        partnerGeoIds: ['US'],
        strictOfficial: true,
        useWitsFallback: true,
        importId: 'run-123',
      })
    );
    const [mfnCtx, ftaCtx] = mocks.withRunMock.mock.calls;
    expect(mfnCtx?.[0]?.params?.strictOfficial).toBeUndefined();
    expect(ftaCtx?.[0]?.params?.strictOfficial).toBe('1');
  });
});
