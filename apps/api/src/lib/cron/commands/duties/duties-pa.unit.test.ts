import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolvePaDutySourceUrlsMock: vi.fn(),
  importPaMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/pa/source-urls.js', () => ({
  PA_MFN_OFFICIAL_SOURCE_KEY: 'duties.pa.official.mfn_excel',
  PA_FTA_OFFICIAL_SOURCE_KEY: 'duties.pa.official.fta_excel',
  resolvePaDutySourceUrls: mocks.resolvePaDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/pa/import-mfn-official.js', () => ({
  importPaMfnOfficial: mocks.importPaMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesPaAllOfficial, dutiesPaMfnOfficial } from './duties-pa.js';

describe('duties-pa commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolvePaDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/pa-mfn.xlsx',
      ftaUrl: 'https://official.test/pa-fta.xlsx',
    });
    mocks.importPaMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'panama-tariff.xlsx',
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

  it('runs PA MFN official import with source metadata', async () => {
    await dutiesPaMfnOfficial([
      '--url=https://override.test/pa-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolvePaDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/pa-mfn.xlsx',
    });
    expect(mocks.importPaMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/pa-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:pa-mfn-official',
      sourceKey: 'duties.pa.official.mfn_excel',
      sourceUrl: 'https://official.test/pa-mfn.xlsx',
    });
  });

  it('runs both PA official steps for import:duties:pa-all-official', async () => {
    await dutiesPaAllOfficial(['--agreement=fta', '--partner=CO']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:pa-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:pa-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'PA',
        agreement: 'fta',
        partner: 'CO',
        importId: 'run-123',
      })
    );
  });
});
