import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveCyDutySourceUrlsMock: vi.fn(),
  importCyMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/cy/source-urls.js', () => ({
  CY_MFN_OFFICIAL_SOURCE_KEY: 'duties.cy.official.mfn_excel',
  CY_FTA_OFFICIAL_SOURCE_KEY: 'duties.cy.official.fta_excel',
  resolveCyDutySourceUrls: mocks.resolveCyDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/cy/import-mfn-official.js', () => ({
  importCyMfnOfficial: mocks.importCyMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesCyAllOfficial, dutiesCyMfnOfficial } from './duties-cy.js';

describe('duties-cy commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveCyDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/cy-mfn.xlsx',
      ftaUrl: 'https://official.test/cy-fta.xlsx',
    });
    mocks.importCyMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'cyprus-tariff.xlsx',
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

  it('runs CY MFN official import with source metadata', async () => {
    await dutiesCyMfnOfficial([
      '--url=https://override.test/cy-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveCyDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/cy-mfn.xlsx',
    });
    expect(mocks.importCyMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/cy-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:cy-mfn-official',
      sourceKey: 'duties.cy.official.mfn_excel',
      sourceUrl: 'https://official.test/cy-mfn.xlsx',
    });
  });

  it('runs both CY official steps for import:duties:cy-all-official', async () => {
    await dutiesCyAllOfficial(['--agreement=fta', '--partner=CY']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:cy-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:cy-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'CY',
        agreement: 'fta',
        partner: 'CY',
        importId: 'run-123',
      })
    );
  });
});
