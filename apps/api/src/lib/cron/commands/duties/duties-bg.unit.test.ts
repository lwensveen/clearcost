import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveBgDutySourceUrlsMock: vi.fn(),
  importBgMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/bg/source-urls.js', () => ({
  BG_MFN_OFFICIAL_SOURCE_KEY: 'duties.bg.official.mfn_excel',
  BG_FTA_OFFICIAL_SOURCE_KEY: 'duties.bg.official.fta_excel',
  resolveBgDutySourceUrls: mocks.resolveBgDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/bg/import-mfn-official.js', () => ({
  importBgMfnOfficial: mocks.importBgMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesBgAllOfficial, dutiesBgMfnOfficial } from './duties-bg.js';

describe('duties-bg commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveBgDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/bg-mfn.xlsx',
      ftaUrl: 'https://official.test/bg-fta.xlsx',
    });
    mocks.importBgMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'bulgaria-tariff.xlsx',
    });
    mocks.importFtaExcelMock.mockResolvedValue({
      ok: true,
      inserted: 1,
      updated: 0,
      count: 1,
      dryRun: false,
      scanned: 1,
      kept: 1,
      skipped: 0,
    });
  });

  it('runs BG MFN official import with source metadata', async () => {
    await dutiesBgMfnOfficial([
      '--url=https://override.test/bg-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveBgDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/bg-mfn.xlsx',
    });
    expect(mocks.importBgMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/bg-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:bg-mfn-official',
      sourceKey: 'duties.bg.official.mfn_excel',
      sourceUrl: 'https://official.test/bg-mfn.xlsx',
    });
  });

  it('runs both BG official steps for import:duties:bg-all-official', async () => {
    await dutiesBgAllOfficial(['--agreement=fta', '--partner=BG']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:bg-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:bg-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'BG',
        agreement: 'fta',
        partner: 'BG',
        importId: 'run-123',
      })
    );
  });
});
