import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveTwDutySourceUrlsMock: vi.fn(),
  importTwMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/tw/source-urls.js', () => ({
  TW_MFN_OFFICIAL_SOURCE_KEY: 'duties.tw.official.mfn_excel',
  TW_FTA_OFFICIAL_SOURCE_KEY: 'duties.tw.official.fta_excel',
  resolveTwDutySourceUrls: mocks.resolveTwDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/tw/import-mfn-official.js', () => ({
  importTwMfnOfficial: mocks.importTwMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesTwAllOfficial, dutiesTwMfnOfficial } from './duties-tw.js';

describe('duties-tw commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveTwDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/tw-mfn.zip',
      ftaUrl: 'https://official.test/tw-fta.xlsx',
    });
    mocks.importTwMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'tw-tariff.xlsx',
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

  it('runs TW MFN official import with source metadata', async () => {
    await dutiesTwMfnOfficial([
      '--url=https://override.test/tw-mfn.zip',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveTwDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/tw-mfn.zip',
    });
    expect(mocks.importTwMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/tw-mfn.zip',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:tw-mfn-official',
      sourceKey: 'duties.tw.official.mfn_excel',
      sourceUrl: 'https://official.test/tw-mfn.zip',
    });
  });

  it('runs both TW official steps for import:duties:tw-all-official', async () => {
    await dutiesTwAllOfficial(['--agreement=ecfa', '--partner=CN']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:tw-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:tw-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'TW',
        agreement: 'ecfa',
        partner: 'CN',
        importId: 'run-123',
      })
    );
  });
});
