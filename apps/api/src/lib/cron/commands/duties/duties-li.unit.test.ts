import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveLiDutySourceUrlsMock: vi.fn(),
  importLiMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/li/source-urls.js', () => ({
  LI_MFN_OFFICIAL_SOURCE_KEY: 'duties.li.official.mfn_excel',
  LI_FTA_OFFICIAL_SOURCE_KEY: 'duties.li.official.fta_excel',
  resolveLiDutySourceUrls: mocks.resolveLiDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/li/import-mfn-official.js', () => ({
  importLiMfnOfficial: mocks.importLiMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesLiAllOfficial, dutiesLiMfnOfficial } from './duties-li.js';

describe('duties-li commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveLiDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/li-mfn.xlsx',
      ftaUrl: 'https://official.test/li-fta.xlsx',
    });
    mocks.importLiMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'liechtenstein-tariff.xlsx',
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

  it('runs LI MFN official import with source metadata', async () => {
    await dutiesLiMfnOfficial([
      '--url=https://override.test/li-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveLiDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/li-mfn.xlsx',
    });
    expect(mocks.importLiMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/li-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:li-mfn-official',
      sourceKey: 'duties.li.official.mfn_excel',
      sourceUrl: 'https://official.test/li-mfn.xlsx',
    });
  });

  it('runs both LI official steps for import:duties:li-all-official', async () => {
    await dutiesLiAllOfficial(['--agreement=efta', '--partner=CH']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:li-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:li-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'LI',
        agreement: 'efta',
        partner: 'CH',
        importId: 'run-123',
      })
    );
  });
});
