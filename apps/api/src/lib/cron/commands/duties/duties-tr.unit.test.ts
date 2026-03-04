import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveTrDutySourceUrlsMock: vi.fn(),
  importTrMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/tr/source-urls.js', () => ({
  TR_MFN_OFFICIAL_SOURCE_KEY: 'duties.tr.official.mfn_excel',
  TR_FTA_OFFICIAL_SOURCE_KEY: 'duties.tr.official.fta_excel',
  resolveTrDutySourceUrls: mocks.resolveTrDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/tr/import-mfn-official.js', () => ({
  importTrMfnOfficial: mocks.importTrMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesTrAllOfficial, dutiesTrMfnOfficial } from './duties-tr.js';

describe('duties-tr commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveTrDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/tr-mfn.xlsx',
      ftaUrl: 'https://official.test/tr-fta.xlsx',
    });
    mocks.importTrMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'turkey-tariff.xlsx',
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

  it('runs TR MFN official import with source metadata', async () => {
    await dutiesTrMfnOfficial([
      '--url=https://override.test/tr-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveTrDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/tr-mfn.xlsx',
    });
    expect(mocks.importTrMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/tr-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:tr-mfn-official',
      sourceKey: 'duties.tr.official.mfn_excel',
      sourceUrl: 'https://official.test/tr-mfn.xlsx',
    });
  });

  it('runs both TR official steps for import:duties:tr-all-official', async () => {
    await dutiesTrAllOfficial(['--agreement=fta', '--partner=TR']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:tr-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:tr-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'TR',
        agreement: 'fta',
        partner: 'TR',
        importId: 'run-123',
      })
    );
  });
});
