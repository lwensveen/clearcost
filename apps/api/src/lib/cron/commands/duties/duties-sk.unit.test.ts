import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveSkDutySourceUrlsMock: vi.fn(),
  importSkMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/sk/source-urls.js', () => ({
  SK_MFN_OFFICIAL_SOURCE_KEY: 'duties.sk.official.mfn_excel',
  SK_FTA_OFFICIAL_SOURCE_KEY: 'duties.sk.official.fta_excel',
  resolveSkDutySourceUrls: mocks.resolveSkDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/sk/import-mfn-official.js', () => ({
  importSkMfnOfficial: mocks.importSkMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesSkAllOfficial, dutiesSkMfnOfficial } from './duties-sk.js';

describe('duties-sk commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveSkDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/sk-mfn.xlsx',
      ftaUrl: 'https://official.test/sk-fta.xlsx',
    });
    mocks.importSkMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'slovakia-tariff.xlsx',
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

  it('runs SK MFN official import with source metadata', async () => {
    await dutiesSkMfnOfficial([
      '--url=https://override.test/sk-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveSkDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/sk-mfn.xlsx',
    });
    expect(mocks.importSkMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/sk-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:sk-mfn-official',
      sourceKey: 'duties.sk.official.mfn_excel',
      sourceUrl: 'https://official.test/sk-mfn.xlsx',
    });
  });

  it('runs both SK official steps for import:duties:sk-all-official', async () => {
    await dutiesSkAllOfficial(['--agreement=fta', '--partner=SK']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:sk-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:sk-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'SK',
        agreement: 'fta',
        partner: 'SK',
        importId: 'run-123',
      })
    );
  });
});
