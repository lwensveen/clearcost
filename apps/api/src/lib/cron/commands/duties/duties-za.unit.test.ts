import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveZaDutySourceUrlsMock: vi.fn(),
  importZaMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/za/source-urls.js', () => ({
  ZA_MFN_OFFICIAL_SOURCE_KEY: 'duties.za.official.mfn_excel',
  ZA_FTA_OFFICIAL_SOURCE_KEY: 'duties.za.official.fta_excel',
  resolveZaDutySourceUrls: mocks.resolveZaDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/za/import-mfn-official.js', () => ({
  importZaMfnOfficial: mocks.importZaMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesZaAllOfficial, dutiesZaMfnOfficial } from './duties-za.js';

describe('duties-za commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveZaDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/za-mfn.zip',
      ftaUrl: 'https://official.test/za-fta.xlsx',
    });
    mocks.importZaMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'za-tariff.xlsx',
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

  it('runs ZA MFN official import with source metadata', async () => {
    await dutiesZaMfnOfficial([
      '--url=https://override.test/za-mfn.zip',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveZaDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/za-mfn.zip',
    });
    expect(mocks.importZaMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/za-mfn.zip',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:za-mfn-official',
      sourceKey: 'duties.za.official.mfn_excel',
      sourceUrl: 'https://official.test/za-mfn.zip',
    });
  });

  it('runs both ZA official steps for import:duties:za-all-official', async () => {
    await dutiesZaAllOfficial(['--agreement=sacu', '--partner=US']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:za-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:za-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'ZA',
        agreement: 'sacu',
        partner: 'US',
        importId: 'run-123',
      })
    );
  });
});
