import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveNoDutySourceUrlsMock: vi.fn(),
  importNoMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/no/source-urls.js', () => ({
  NO_MFN_OFFICIAL_SOURCE_KEY: 'duties.no.official.mfn_excel',
  NO_FTA_OFFICIAL_SOURCE_KEY: 'duties.no.official.fta_excel',
  resolveNoDutySourceUrls: mocks.resolveNoDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/no/import-mfn-official.js', () => ({
  importNoMfnOfficial: mocks.importNoMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesNoAllOfficial, dutiesNoMfnOfficial } from './duties-no.js';

describe('duties-no commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveNoDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/no-mfn.xlsx',
      ftaUrl: 'https://official.test/no-fta.xlsx',
    });
    mocks.importNoMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'norway-tariff.xlsx',
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

  it('runs NO MFN official import with source metadata', async () => {
    await dutiesNoMfnOfficial([
      '--url=https://override.test/no-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveNoDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/no-mfn.xlsx',
    });
    expect(mocks.importNoMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/no-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:no-mfn-official',
      sourceKey: 'duties.no.official.mfn_excel',
      sourceUrl: 'https://official.test/no-mfn.xlsx',
    });
  });

  it('runs both NO official steps for import:duties:no-all-official', async () => {
    await dutiesNoAllOfficial(['--agreement=efta', '--partner=CH']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:no-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:no-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'NO',
        agreement: 'efta',
        partner: 'CH',
        importId: 'run-123',
      })
    );
  });
});
