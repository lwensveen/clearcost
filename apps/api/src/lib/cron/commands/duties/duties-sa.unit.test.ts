import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveSaDutySourceUrlsMock: vi.fn(),
  importSaMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/sa/source-urls.js', () => ({
  SA_MFN_OFFICIAL_SOURCE_KEY: 'duties.sa.official.mfn_excel',
  SA_FTA_OFFICIAL_SOURCE_KEY: 'duties.sa.official.fta_excel',
  resolveSaDutySourceUrls: mocks.resolveSaDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/sa/import-mfn-official.js', () => ({
  importSaMfnOfficial: mocks.importSaMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesSaAllOfficial, dutiesSaMfnOfficial } from './duties-sa.js';

describe('duties-sa commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveSaDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/sa-mfn.xlsx',
      ftaUrl: 'https://official.test/sa-fta.xlsx',
    });
    mocks.importSaMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'sa-mfn.xlsx',
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

  it('runs SA MFN official import with source metadata', async () => {
    await dutiesSaMfnOfficial([
      '--url=https://override.test/sa-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveSaDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/sa-mfn.xlsx',
    });
    expect(mocks.importSaMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/sa-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:sa-mfn-official',
      sourceKey: 'duties.sa.official.mfn_excel',
      sourceUrl: 'https://official.test/sa-mfn.xlsx',
    });
  });

  it('runs both SA official steps for import:duties:sa-all-official', async () => {
    await dutiesSaAllOfficial(['--agreement=fta', '--partner=SA']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:sa-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:sa-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'SA',
        agreement: 'fta',
        partner: 'SA',
        importId: 'run-123',
      })
    );
  });
});
