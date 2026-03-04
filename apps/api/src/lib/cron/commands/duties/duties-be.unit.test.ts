import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveBeDutySourceUrlsMock: vi.fn(),
  importBeMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/be/source-urls.js', () => ({
  BE_MFN_OFFICIAL_SOURCE_KEY: 'duties.be.official.mfn_excel',
  BE_FTA_OFFICIAL_SOURCE_KEY: 'duties.be.official.fta_excel',
  resolveBeDutySourceUrls: mocks.resolveBeDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/be/import-mfn-official.js', () => ({
  importBeMfnOfficial: mocks.importBeMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesBeAllOfficial, dutiesBeMfnOfficial } from './duties-be.js';

describe('duties-be commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveBeDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/be-mfn.xlsx',
      ftaUrl: 'https://official.test/be-fta.xlsx',
    });
    mocks.importBeMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'belgium-tariff.xlsx',
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

  it('runs BE MFN official import with source metadata', async () => {
    await dutiesBeMfnOfficial([
      '--url=https://override.test/be-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveBeDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/be-mfn.xlsx',
    });
    expect(mocks.importBeMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/be-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:be-mfn-official',
      sourceKey: 'duties.be.official.mfn_excel',
      sourceUrl: 'https://official.test/be-mfn.xlsx',
    });
  });

  it('runs both BE official steps for import:duties:be-all-official', async () => {
    await dutiesBeAllOfficial(['--agreement=fta', '--partner=BE']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:be-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:be-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'BE',
        agreement: 'fta',
        partner: 'BE',
        importId: 'run-123',
      })
    );
  });
});
