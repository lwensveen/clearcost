import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveAsDutySourceUrlsMock: vi.fn(),
  importAsMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/as/source-urls.js', () => ({
  AS_MFN_OFFICIAL_SOURCE_KEY: 'duties.as.official.mfn_excel',
  AS_FTA_OFFICIAL_SOURCE_KEY: 'duties.as.official.fta_excel',
  resolveAsDutySourceUrls: mocks.resolveAsDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/as/import-mfn-official.js', () => ({
  importAsMfnOfficial: mocks.importAsMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesAsAllOfficial, dutiesAsMfnOfficial } from './duties-as.js';

describe('duties-as commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveAsDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/as-mfn.xlsx',
      ftaUrl: 'https://official.test/as-fta.xlsx',
    });
    mocks.importAsMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'as-tariff.xlsx',
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

  it('runs AS MFN official import with source metadata', async () => {
    await dutiesAsMfnOfficial([
      '--url=https://override.test/as-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveAsDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/as-mfn.xlsx',
    });
    expect(mocks.importAsMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/as-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:as-mfn-official',
      sourceKey: 'duties.as.official.mfn_excel',
      sourceUrl: 'https://official.test/as-mfn.xlsx',
    });
  });

  it('runs both AS official steps for import:duties:as-all-official', async () => {
    await dutiesAsAllOfficial(['--agreement=fta', '--partner=AS']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:as-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:as-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'AS',
        agreement: 'fta',
        partner: 'AS',
        importId: 'run-123',
      })
    );
  });
});
