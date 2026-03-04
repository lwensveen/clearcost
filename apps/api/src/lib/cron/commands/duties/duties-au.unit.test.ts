import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveAuDutySourceUrlsMock: vi.fn(),
  importAuMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/au/source-urls.js', () => ({
  AU_MFN_OFFICIAL_SOURCE_KEY: 'duties.au.official.mfn_excel',
  AU_FTA_OFFICIAL_SOURCE_KEY: 'duties.au.official.fta_excel',
  resolveAuDutySourceUrls: mocks.resolveAuDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/au/import-mfn-official.js', () => ({
  importAuMfnOfficial: mocks.importAuMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesAuAllOfficial, dutiesAuMfnOfficial } from './duties-au.js';

describe('duties-au commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveAuDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/au-mfn.xlsx',
      ftaUrl: 'https://official.test/au-fta.xlsx',
    });
    mocks.importAuMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'working-tariff.xlsx',
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

  it('runs AU MFN official import with source metadata', async () => {
    await dutiesAuMfnOfficial([
      '--url=https://override.test/au-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveAuDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/au-mfn.xlsx',
    });
    expect(mocks.importAuMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/au-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:au-mfn-official',
      sourceKey: 'duties.au.official.mfn_excel',
      sourceUrl: 'https://official.test/au-mfn.xlsx',
    });
  });

  it('runs both AU official steps for import:duties:au-all-official', async () => {
    await dutiesAuAllOfficial(['--agreement=ausfta', '--partner=US']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:au-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:au-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'AU',
        agreement: 'ausfta',
        partner: 'US',
        importId: 'run-123',
      })
    );
  });
});
