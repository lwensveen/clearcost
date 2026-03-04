import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveIeDutySourceUrlsMock: vi.fn(),
  importIeMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/ie/source-urls.js', () => ({
  IE_MFN_OFFICIAL_SOURCE_KEY: 'duties.ie.official.mfn_excel',
  IE_FTA_OFFICIAL_SOURCE_KEY: 'duties.ie.official.fta_excel',
  resolveIeDutySourceUrls: mocks.resolveIeDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/ie/import-mfn-official.js', () => ({
  importIeMfnOfficial: mocks.importIeMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesIeAllOfficial, dutiesIeMfnOfficial } from './duties-ie.js';

describe('duties-ie commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveIeDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/ie-mfn.xlsx',
      ftaUrl: 'https://official.test/ie-fta.xlsx',
    });
    mocks.importIeMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'ireland-tariff.xlsx',
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

  it('runs IE MFN official import with source metadata', async () => {
    await dutiesIeMfnOfficial([
      '--url=https://override.test/ie-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveIeDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/ie-mfn.xlsx',
    });
    expect(mocks.importIeMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/ie-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:ie-mfn-official',
      sourceKey: 'duties.ie.official.mfn_excel',
      sourceUrl: 'https://official.test/ie-mfn.xlsx',
    });
  });

  it('runs both IE official steps for import:duties:ie-all-official', async () => {
    await dutiesIeAllOfficial(['--agreement=fta', '--partner=IE']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:ie-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:ie-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'IE',
        agreement: 'fta',
        partner: 'IE',
        importId: 'run-123',
      })
    );
  });
});
