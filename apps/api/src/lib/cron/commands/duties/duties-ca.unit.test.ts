import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveCaDutySourceUrlsMock: vi.fn(),
  importCaMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/ca/source-urls.js', () => ({
  CA_MFN_OFFICIAL_SOURCE_KEY: 'duties.ca.official.mfn_excel',
  CA_FTA_OFFICIAL_SOURCE_KEY: 'duties.ca.official.fta_excel',
  resolveCaDutySourceUrls: mocks.resolveCaDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/ca/import-mfn-official.js', () => ({
  importCaMfnOfficial: mocks.importCaMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesCaAllOfficial, dutiesCaMfnOfficial } from './duties-ca.js';

describe('duties-ca commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveCaDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/ca-mfn.zip',
      ftaUrl: 'https://official.test/ca-fta.xlsx',
    });
    mocks.importCaMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: '01-99.xlsx',
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

  it('runs CA MFN official import with source metadata', async () => {
    await dutiesCaMfnOfficial([
      '--url=https://override.test/ca-mfn.zip',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveCaDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/ca-mfn.zip',
    });
    expect(mocks.importCaMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/ca-mfn.zip',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:ca-mfn-official',
      sourceKey: 'duties.ca.official.mfn_excel',
      sourceUrl: 'https://official.test/ca-mfn.zip',
    });
  });

  it('runs both CA official steps for import:duties:ca-all-official', async () => {
    await dutiesCaAllOfficial(['--agreement=cusma', '--partner=US']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:ca-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:ca-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'CA',
        agreement: 'cusma',
        partner: 'US',
        importId: 'run-123',
      })
    );
  });
});
