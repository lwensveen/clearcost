import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveNgDutySourceUrlsMock: vi.fn(),
  importNgMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/ng/source-urls.js', () => ({
  NG_MFN_OFFICIAL_SOURCE_KEY: 'duties.ng.official.mfn_excel',
  NG_FTA_OFFICIAL_SOURCE_KEY: 'duties.ng.official.fta_excel',
  resolveNgDutySourceUrls: mocks.resolveNgDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/ng/import-mfn-official.js', () => ({
  importNgMfnOfficial: mocks.importNgMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesNgAllOfficial, dutiesNgMfnOfficial } from './duties-ng.js';

describe('duties-ng commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveNgDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/ng-mfn.xlsx',
      ftaUrl: 'https://official.test/ng-fta.xlsx',
    });
    mocks.importNgMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'nigeria-tariff.xlsx',
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

  it('runs NG MFN official import with source metadata', async () => {
    await dutiesNgMfnOfficial([
      '--url=https://override.test/ng-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveNgDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/ng-mfn.xlsx',
    });
    expect(mocks.importNgMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/ng-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:ng-mfn-official',
      sourceKey: 'duties.ng.official.mfn_excel',
      sourceUrl: 'https://official.test/ng-mfn.xlsx',
    });
  });

  it('runs both NG official steps for import:duties:ng-all-official', async () => {
    await dutiesNgAllOfficial(['--agreement=fta', '--partner=NG']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:ng-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:ng-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'NG',
        agreement: 'fta',
        partner: 'NG',
        importId: 'run-123',
      })
    );
  });
});
