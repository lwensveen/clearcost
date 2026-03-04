import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveArDutySourceUrlsMock: vi.fn(),
  importArMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/ar/source-urls.js', () => ({
  AR_MFN_OFFICIAL_SOURCE_KEY: 'duties.ar.official.mfn_excel',
  AR_FTA_OFFICIAL_SOURCE_KEY: 'duties.ar.official.fta_excel',
  resolveArDutySourceUrls: mocks.resolveArDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/ar/import-mfn-official.js', () => ({
  importArMfnOfficial: mocks.importArMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesArAllOfficial, dutiesArMfnOfficial } from './duties-ar.js';

describe('duties-ar commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveArDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/ar-mfn.zip',
      ftaUrl: 'https://official.test/ar-fta.xlsx',
    });
    mocks.importArMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'ar-tariff.xlsx',
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

  it('runs AR MFN official import with source metadata', async () => {
    await dutiesArMfnOfficial([
      '--url=https://override.test/ar-mfn.zip',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveArDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/ar-mfn.zip',
    });
    expect(mocks.importArMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/ar-mfn.zip',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:ar-mfn-official',
      sourceKey: 'duties.ar.official.mfn_excel',
      sourceUrl: 'https://official.test/ar-mfn.zip',
    });
  });

  it('runs both AR official steps for import:duties:ar-all-official', async () => {
    await dutiesArAllOfficial(['--agreement=mercosur', '--partner=BR']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:ar-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:ar-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'AR',
        agreement: 'mercosur',
        partner: 'BR',
        importId: 'run-123',
      })
    );
  });
});
