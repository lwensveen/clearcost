import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveCzDutySourceUrlsMock: vi.fn(),
  importCzMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/cz/source-urls.js', () => ({
  CZ_MFN_OFFICIAL_SOURCE_KEY: 'duties.cz.official.mfn_excel',
  CZ_FTA_OFFICIAL_SOURCE_KEY: 'duties.cz.official.fta_excel',
  resolveCzDutySourceUrls: mocks.resolveCzDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/cz/import-mfn-official.js', () => ({
  importCzMfnOfficial: mocks.importCzMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesCzAllOfficial, dutiesCzMfnOfficial } from './duties-cz.js';

describe('duties-cz commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveCzDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/cz-mfn.xlsx',
      ftaUrl: 'https://official.test/cz-fta.xlsx',
    });
    mocks.importCzMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'czechia-tariff.xlsx',
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

  it('runs CZ MFN official import with source metadata', async () => {
    await dutiesCzMfnOfficial([
      '--url=https://override.test/cz-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveCzDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/cz-mfn.xlsx',
    });
    expect(mocks.importCzMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/cz-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:cz-mfn-official',
      sourceKey: 'duties.cz.official.mfn_excel',
      sourceUrl: 'https://official.test/cz-mfn.xlsx',
    });
  });

  it('runs both CZ official steps for import:duties:cz-all-official', async () => {
    await dutiesCzAllOfficial(['--agreement=fta', '--partner=CZ']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:cz-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:cz-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'CZ',
        agreement: 'fta',
        partner: 'CZ',
        importId: 'run-123',
      })
    );
  });
});
