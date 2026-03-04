import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveBrDutySourceUrlsMock: vi.fn(),
  importBrMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/br/source-urls.js', () => ({
  BR_MFN_OFFICIAL_SOURCE_KEY: 'duties.br.official.mfn_excel',
  BR_FTA_OFFICIAL_SOURCE_KEY: 'duties.br.official.fta_excel',
  resolveBrDutySourceUrls: mocks.resolveBrDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/br/import-mfn-official.js', () => ({
  importBrMfnOfficial: mocks.importBrMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesBrAllOfficial, dutiesBrMfnOfficial } from './duties-br.js';

describe('duties-br commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveBrDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/br-mfn.zip',
      ftaUrl: 'https://official.test/br-fta.xlsx',
    });
    mocks.importBrMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'br-tariff.xlsx',
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

  it('runs BR MFN official import with source metadata', async () => {
    await dutiesBrMfnOfficial([
      '--url=https://override.test/br-mfn.zip',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveBrDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/br-mfn.zip',
    });
    expect(mocks.importBrMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/br-mfn.zip',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:br-mfn-official',
      sourceKey: 'duties.br.official.mfn_excel',
      sourceUrl: 'https://official.test/br-mfn.zip',
    });
  });

  it('runs both BR official steps for import:duties:br-all-official', async () => {
    await dutiesBrAllOfficial(['--agreement=mercosur', '--partner=US']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:br-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:br-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'BR',
        agreement: 'mercosur',
        partner: 'US',
        importId: 'run-123',
      })
    );
  });
});
