import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveInDutySourceUrlsMock: vi.fn(),
  importInMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/in/source-urls.js', () => ({
  IN_MFN_OFFICIAL_SOURCE_KEY: 'duties.in.official.mfn_excel',
  IN_FTA_OFFICIAL_SOURCE_KEY: 'duties.in.official.fta_excel',
  resolveInDutySourceUrls: mocks.resolveInDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/in/import-mfn-official.js', () => ({
  importInMfnOfficial: mocks.importInMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesInAllOfficial, dutiesInMfnOfficial } from './duties-in.js';

describe('duties-in commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveInDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/in-mfn.xlsx',
      ftaUrl: 'https://official.test/in-fta.xlsx',
    });
    mocks.importInMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'in-mfn.xlsx',
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

  it('runs IN MFN official import with source metadata', async () => {
    await dutiesInMfnOfficial([
      '--url=https://override.test/in-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveInDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/in-mfn.xlsx',
    });
    expect(mocks.importInMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/in-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:in-mfn-official',
      sourceKey: 'duties.in.official.mfn_excel',
      sourceUrl: 'https://official.test/in-mfn.xlsx',
    });
  });

  it('runs both IN official steps for import:duties:in-all-official', async () => {
    await dutiesInAllOfficial(['--agreement=fta', '--partner=IN']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:in-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:in-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'IN',
        agreement: 'fta',
        partner: 'IN',
        importId: 'run-123',
      })
    );
  });
});
