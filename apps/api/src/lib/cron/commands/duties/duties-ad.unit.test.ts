import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveAdDutySourceUrlsMock: vi.fn(),
  importAdMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/ad/source-urls.js', () => ({
  AD_MFN_OFFICIAL_SOURCE_KEY: 'duties.ad.official.mfn_excel',
  AD_FTA_OFFICIAL_SOURCE_KEY: 'duties.ad.official.fta_excel',
  resolveAdDutySourceUrls: mocks.resolveAdDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/ad/import-mfn-official.js', () => ({
  importAdMfnOfficial: mocks.importAdMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesAdAllOfficial, dutiesAdMfnOfficial } from './duties-ad.js';

describe('duties-ad commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveAdDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/ad-mfn.xlsx',
      ftaUrl: 'https://official.test/ad-fta.xlsx',
    });
    mocks.importAdMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'ad-tariff.xlsx',
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

  it('runs AD MFN official import with source metadata', async () => {
    await dutiesAdMfnOfficial([
      '--url=https://override.test/ad-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveAdDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/ad-mfn.xlsx',
    });
    expect(mocks.importAdMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/ad-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:ad-mfn-official',
      sourceKey: 'duties.ad.official.mfn_excel',
      sourceUrl: 'https://official.test/ad-mfn.xlsx',
    });
  });

  it('runs both AD official steps for import:duties:ad-all-official', async () => {
    await dutiesAdAllOfficial(['--agreement=fta', '--partner=AD']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:ad-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:ad-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'AD',
        agreement: 'fta',
        partner: 'AD',
        importId: 'run-123',
      })
    );
  });
});
