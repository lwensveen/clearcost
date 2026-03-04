import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolvePlDutySourceUrlsMock: vi.fn(),
  importPlMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/pl/source-urls.js', () => ({
  PL_MFN_OFFICIAL_SOURCE_KEY: 'duties.pl.official.mfn_excel',
  PL_FTA_OFFICIAL_SOURCE_KEY: 'duties.pl.official.fta_excel',
  resolvePlDutySourceUrls: mocks.resolvePlDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/pl/import-mfn-official.js', () => ({
  importPlMfnOfficial: mocks.importPlMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesPlAllOfficial, dutiesPlMfnOfficial } from './duties-pl.js';

describe('duties-pl commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolvePlDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/pl-mfn.xlsx',
      ftaUrl: 'https://official.test/pl-fta.xlsx',
    });
    mocks.importPlMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'poland-tariff.xlsx',
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

  it('runs PL MFN official import with source metadata', async () => {
    await dutiesPlMfnOfficial([
      '--url=https://override.test/pl-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolvePlDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/pl-mfn.xlsx',
    });
    expect(mocks.importPlMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/pl-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:pl-mfn-official',
      sourceKey: 'duties.pl.official.mfn_excel',
      sourceUrl: 'https://official.test/pl-mfn.xlsx',
    });
  });

  it('runs both PL official steps for import:duties:pl-all-official', async () => {
    await dutiesPlAllOfficial(['--agreement=fta', '--partner=DE']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:pl-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:pl-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'PL',
        agreement: 'fta',
        partner: 'DE',
        importId: 'run-123',
      })
    );
  });
});
