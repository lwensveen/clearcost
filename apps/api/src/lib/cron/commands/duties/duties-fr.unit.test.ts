import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveFrDutySourceUrlsMock: vi.fn(),
  importFrMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/fr/source-urls.js', () => ({
  FR_MFN_OFFICIAL_SOURCE_KEY: 'duties.fr.official.mfn_excel',
  FR_FTA_OFFICIAL_SOURCE_KEY: 'duties.fr.official.fta_excel',
  resolveFrDutySourceUrls: mocks.resolveFrDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/fr/import-mfn-official.js', () => ({
  importFrMfnOfficial: mocks.importFrMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesFrAllOfficial, dutiesFrMfnOfficial } from './duties-fr.js';

describe('duties-fr commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveFrDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/fr-mfn.xlsx',
      ftaUrl: 'https://official.test/fr-fta.xlsx',
    });
    mocks.importFrMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'france-tariff.xlsx',
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

  it('runs FR MFN official import with source metadata', async () => {
    await dutiesFrMfnOfficial([
      '--url=https://override.test/fr-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveFrDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/fr-mfn.xlsx',
    });
    expect(mocks.importFrMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/fr-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:fr-mfn-official',
      sourceKey: 'duties.fr.official.mfn_excel',
      sourceUrl: 'https://official.test/fr-mfn.xlsx',
    });
  });

  it('runs both FR official steps for import:duties:fr-all-official', async () => {
    await dutiesFrAllOfficial(['--agreement=fta', '--partner=DE']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:fr-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:fr-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'FR',
        agreement: 'fta',
        partner: 'DE',
        importId: 'run-123',
      })
    );
  });
});
