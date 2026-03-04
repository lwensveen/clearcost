import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveGhDutySourceUrlsMock: vi.fn(),
  importGhMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/gh/source-urls.js', () => ({
  GH_MFN_OFFICIAL_SOURCE_KEY: 'duties.gh.official.mfn_excel',
  GH_FTA_OFFICIAL_SOURCE_KEY: 'duties.gh.official.fta_excel',
  resolveGhDutySourceUrls: mocks.resolveGhDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/gh/import-mfn-official.js', () => ({
  importGhMfnOfficial: mocks.importGhMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesGhAllOfficial, dutiesGhMfnOfficial } from './duties-gh.js';

describe('duties-gh commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveGhDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/gh-mfn.xlsx',
      ftaUrl: 'https://official.test/gh-fta.xlsx',
    });
    mocks.importGhMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'ghana-tariff.xlsx',
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

  it('runs GH MFN official import with source metadata', async () => {
    await dutiesGhMfnOfficial([
      '--url=https://override.test/gh-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveGhDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/gh-mfn.xlsx',
    });
    expect(mocks.importGhMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/gh-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:gh-mfn-official',
      sourceKey: 'duties.gh.official.mfn_excel',
      sourceUrl: 'https://official.test/gh-mfn.xlsx',
    });
  });

  it('runs both GH official steps for import:duties:gh-all-official', async () => {
    await dutiesGhAllOfficial(['--agreement=fta', '--partner=GH']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:gh-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:gh-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'GH',
        agreement: 'fta',
        partner: 'GH',
        importId: 'run-123',
      })
    );
  });
});
