import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveSiDutySourceUrlsMock: vi.fn(),
  importSiMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/si/source-urls.js', () => ({
  SI_MFN_OFFICIAL_SOURCE_KEY: 'duties.si.official.mfn_excel',
  SI_FTA_OFFICIAL_SOURCE_KEY: 'duties.si.official.fta_excel',
  resolveSiDutySourceUrls: mocks.resolveSiDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/si/import-mfn-official.js', () => ({
  importSiMfnOfficial: mocks.importSiMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesSiAllOfficial, dutiesSiMfnOfficial } from './duties-si.js';

describe('duties-si commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveSiDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/si-mfn.xlsx',
      ftaUrl: 'https://official.test/si-fta.xlsx',
    });
    mocks.importSiMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'slovenia-tariff.xlsx',
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

  it('runs SI MFN official import with source metadata', async () => {
    await dutiesSiMfnOfficial([
      '--url=https://override.test/si-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveSiDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/si-mfn.xlsx',
    });
    expect(mocks.importSiMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/si-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:si-mfn-official',
      sourceKey: 'duties.si.official.mfn_excel',
      sourceUrl: 'https://official.test/si-mfn.xlsx',
    });
  });

  it('runs both SI official steps for import:duties:si-all-official', async () => {
    await dutiesSiAllOfficial(['--agreement=fta', '--partner=SI']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:si-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:si-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'SI',
        agreement: 'fta',
        partner: 'SI',
        importId: 'run-123',
      })
    );
  });
});
