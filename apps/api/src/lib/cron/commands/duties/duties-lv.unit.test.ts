import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveLvDutySourceUrlsMock: vi.fn(),
  importLvMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/lv/source-urls.js', () => ({
  LV_MFN_OFFICIAL_SOURCE_KEY: 'duties.lv.official.mfn_excel',
  LV_FTA_OFFICIAL_SOURCE_KEY: 'duties.lv.official.fta_excel',
  resolveLvDutySourceUrls: mocks.resolveLvDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/lv/import-mfn-official.js', () => ({
  importLvMfnOfficial: mocks.importLvMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesLvAllOfficial, dutiesLvMfnOfficial } from './duties-lv.js';

describe('duties-lv commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveLvDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/lv-mfn.xlsx',
      ftaUrl: 'https://official.test/lv-fta.xlsx',
    });
    mocks.importLvMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'latvia-tariff.xlsx',
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

  it('runs LV MFN official import with source metadata', async () => {
    await dutiesLvMfnOfficial([
      '--url=https://override.test/lv-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveLvDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/lv-mfn.xlsx',
    });
    expect(mocks.importLvMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/lv-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:lv-mfn-official',
      sourceKey: 'duties.lv.official.mfn_excel',
      sourceUrl: 'https://official.test/lv-mfn.xlsx',
    });
  });

  it('runs both LV official steps for import:duties:lv-all-official', async () => {
    await dutiesLvAllOfficial(['--agreement=fta', '--partner=LV']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:lv-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:lv-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'LV',
        agreement: 'fta',
        partner: 'LV',
        importId: 'run-123',
      })
    );
  });
});
