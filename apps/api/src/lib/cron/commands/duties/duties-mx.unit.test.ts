import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveMxDutySourceUrlsMock: vi.fn(),
  importMxMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/mx/source-urls.js', () => ({
  MX_MFN_OFFICIAL_SOURCE_KEY: 'duties.mx.official.mfn_excel',
  MX_FTA_OFFICIAL_SOURCE_KEY: 'duties.mx.official.fta_excel',
  resolveMxDutySourceUrls: mocks.resolveMxDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/mx/import-mfn-official.js', () => ({
  importMxMfnOfficial: mocks.importMxMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesMxAllOfficial, dutiesMxMfnOfficial } from './duties-mx.js';

describe('duties-mx commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveMxDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/mx-mfn.zip',
      ftaUrl: 'https://official.test/mx-fta.xlsx',
    });
    mocks.importMxMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'tigie.xlsx',
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

  it('runs MX MFN official import with source metadata', async () => {
    await dutiesMxMfnOfficial([
      '--url=https://override.test/mx-mfn.zip',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveMxDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/mx-mfn.zip',
    });
    expect(mocks.importMxMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/mx-mfn.zip',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:mx-mfn-official',
      sourceKey: 'duties.mx.official.mfn_excel',
      sourceUrl: 'https://official.test/mx-mfn.zip',
    });
  });

  it('runs both MX official steps for import:duties:mx-all-official', async () => {
    await dutiesMxAllOfficial(['--agreement=cusma', '--partner=US']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:mx-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:mx-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'MX',
        agreement: 'cusma',
        partner: 'US',
        importId: 'run-123',
      })
    );
  });
});
