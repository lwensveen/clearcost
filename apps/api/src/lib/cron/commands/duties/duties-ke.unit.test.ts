import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveKeDutySourceUrlsMock: vi.fn(),
  importKeMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/ke/source-urls.js', () => ({
  KE_MFN_OFFICIAL_SOURCE_KEY: 'duties.ke.official.mfn_excel',
  KE_FTA_OFFICIAL_SOURCE_KEY: 'duties.ke.official.fta_excel',
  resolveKeDutySourceUrls: mocks.resolveKeDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/ke/import-mfn-official.js', () => ({
  importKeMfnOfficial: mocks.importKeMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesKeAllOfficial, dutiesKeMfnOfficial } from './duties-ke.js';

describe('duties-ke commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveKeDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/ke-mfn.xlsx',
      ftaUrl: 'https://official.test/ke-fta.xlsx',
    });
    mocks.importKeMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'kenya-tariff.xlsx',
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

  it('runs KE MFN official import with source metadata', async () => {
    await dutiesKeMfnOfficial([
      '--url=https://override.test/ke-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveKeDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/ke-mfn.xlsx',
    });
    expect(mocks.importKeMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/ke-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:ke-mfn-official',
      sourceKey: 'duties.ke.official.mfn_excel',
      sourceUrl: 'https://official.test/ke-mfn.xlsx',
    });
  });

  it('runs both KE official steps for import:duties:ke-all-official', async () => {
    await dutiesKeAllOfficial(['--agreement=fta', '--partner=KE']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:ke-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:ke-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'KE',
        agreement: 'fta',
        partner: 'KE',
        importId: 'run-123',
      })
    );
  });
});
