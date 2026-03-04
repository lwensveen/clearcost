import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveBdDutySourceUrlsMock: vi.fn(),
  importBdMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/bd/source-urls.js', () => ({
  BD_MFN_OFFICIAL_SOURCE_KEY: 'duties.bd.official.mfn_excel',
  BD_FTA_OFFICIAL_SOURCE_KEY: 'duties.bd.official.fta_excel',
  resolveBdDutySourceUrls: mocks.resolveBdDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/bd/import-mfn-official.js', () => ({
  importBdMfnOfficial: mocks.importBdMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesBdAllOfficial, dutiesBdMfnOfficial } from './duties-bd.js';

describe('duties-bd commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveBdDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/bd-mfn.xlsx',
      ftaUrl: 'https://official.test/bd-fta.xlsx',
    });
    mocks.importBdMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'bangladesh-tariff.xlsx',
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

  it('runs BD MFN official import with source metadata', async () => {
    await dutiesBdMfnOfficial([
      '--url=https://override.test/bd-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveBdDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/bd-mfn.xlsx',
    });
    expect(mocks.importBdMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/bd-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:bd-mfn-official',
      sourceKey: 'duties.bd.official.mfn_excel',
      sourceUrl: 'https://official.test/bd-mfn.xlsx',
    });
  });

  it('runs both BD official steps for import:duties:bd-all-official', async () => {
    await dutiesBdAllOfficial(['--agreement=fta', '--partner=BD']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:bd-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:bd-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'BD',
        agreement: 'fta',
        partner: 'BD',
        importId: 'run-123',
      })
    );
  });
});
