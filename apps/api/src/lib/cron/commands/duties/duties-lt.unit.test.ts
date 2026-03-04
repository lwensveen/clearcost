import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveLtDutySourceUrlsMock: vi.fn(),
  importLtMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/lt/source-urls.js', () => ({
  LT_MFN_OFFICIAL_SOURCE_KEY: 'duties.lt.official.mfn_excel',
  LT_FTA_OFFICIAL_SOURCE_KEY: 'duties.lt.official.fta_excel',
  resolveLtDutySourceUrls: mocks.resolveLtDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/lt/import-mfn-official.js', () => ({
  importLtMfnOfficial: mocks.importLtMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesLtAllOfficial, dutiesLtMfnOfficial } from './duties-lt.js';

describe('duties-lt commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveLtDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/lt-mfn.xlsx',
      ftaUrl: 'https://official.test/lt-fta.xlsx',
    });
    mocks.importLtMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'lithuania-tariff.xlsx',
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

  it('runs LT MFN official import with source metadata', async () => {
    await dutiesLtMfnOfficial([
      '--url=https://override.test/lt-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveLtDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/lt-mfn.xlsx',
    });
    expect(mocks.importLtMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/lt-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:lt-mfn-official',
      sourceKey: 'duties.lt.official.mfn_excel',
      sourceUrl: 'https://official.test/lt-mfn.xlsx',
    });
  });

  it('runs both LT official steps for import:duties:lt-all-official', async () => {
    await dutiesLtAllOfficial(['--agreement=fta', '--partner=LT']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:lt-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:lt-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'LT',
        agreement: 'fta',
        partner: 'LT',
        importId: 'run-123',
      })
    );
  });
});
