import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveSeDutySourceUrlsMock: vi.fn(),
  importSeMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/se/source-urls.js', () => ({
  SE_MFN_OFFICIAL_SOURCE_KEY: 'duties.se.official.mfn_excel',
  SE_FTA_OFFICIAL_SOURCE_KEY: 'duties.se.official.fta_excel',
  resolveSeDutySourceUrls: mocks.resolveSeDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/se/import-mfn-official.js', () => ({
  importSeMfnOfficial: mocks.importSeMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesSeAllOfficial, dutiesSeMfnOfficial } from './duties-se.js';

describe('duties-se commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveSeDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/se-mfn.xlsx',
      ftaUrl: 'https://official.test/se-fta.xlsx',
    });
    mocks.importSeMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'sweden-tariff.xlsx',
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

  it('runs SE MFN official import with source metadata', async () => {
    await dutiesSeMfnOfficial([
      '--url=https://override.test/se-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveSeDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/se-mfn.xlsx',
    });
    expect(mocks.importSeMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/se-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:se-mfn-official',
      sourceKey: 'duties.se.official.mfn_excel',
      sourceUrl: 'https://official.test/se-mfn.xlsx',
    });
  });

  it('runs both SE official steps for import:duties:se-all-official', async () => {
    await dutiesSeAllOfficial(['--agreement=fta', '--partner=SE']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:se-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:se-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'SE',
        agreement: 'fta',
        partner: 'SE',
        importId: 'run-123',
      })
    );
  });
});
