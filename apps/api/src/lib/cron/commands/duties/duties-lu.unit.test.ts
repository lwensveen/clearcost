import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveLuDutySourceUrlsMock: vi.fn(),
  importLuMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/lu/source-urls.js', () => ({
  LU_MFN_OFFICIAL_SOURCE_KEY: 'duties.lu.official.mfn_excel',
  LU_FTA_OFFICIAL_SOURCE_KEY: 'duties.lu.official.fta_excel',
  resolveLuDutySourceUrls: mocks.resolveLuDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/lu/import-mfn-official.js', () => ({
  importLuMfnOfficial: mocks.importLuMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesLuAllOfficial, dutiesLuMfnOfficial } from './duties-lu.js';

describe('duties-lu commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveLuDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/lu-mfn.xlsx',
      ftaUrl: 'https://official.test/lu-fta.xlsx',
    });
    mocks.importLuMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'luxembourg-tariff.xlsx',
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

  it('runs LU MFN official import with source metadata', async () => {
    await dutiesLuMfnOfficial([
      '--url=https://override.test/lu-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveLuDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/lu-mfn.xlsx',
    });
    expect(mocks.importLuMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/lu-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:lu-mfn-official',
      sourceKey: 'duties.lu.official.mfn_excel',
      sourceUrl: 'https://official.test/lu-mfn.xlsx',
    });
  });

  it('runs both LU official steps for import:duties:lu-all-official', async () => {
    await dutiesLuAllOfficial(['--agreement=fta', '--partner=LU']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:lu-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:lu-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'LU',
        agreement: 'fta',
        partner: 'LU',
        importId: 'run-123',
      })
    );
  });
});
