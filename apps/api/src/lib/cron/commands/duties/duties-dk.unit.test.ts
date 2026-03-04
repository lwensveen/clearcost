import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveDkDutySourceUrlsMock: vi.fn(),
  importDkMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/dk/source-urls.js', () => ({
  DK_MFN_OFFICIAL_SOURCE_KEY: 'duties.dk.official.mfn_excel',
  DK_FTA_OFFICIAL_SOURCE_KEY: 'duties.dk.official.fta_excel',
  resolveDkDutySourceUrls: mocks.resolveDkDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/dk/import-mfn-official.js', () => ({
  importDkMfnOfficial: mocks.importDkMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesDkAllOfficial, dutiesDkMfnOfficial } from './duties-dk.js';

describe('duties-dk commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveDkDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/dk-mfn.xlsx',
      ftaUrl: 'https://official.test/dk-fta.xlsx',
    });
    mocks.importDkMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'denmark-tariff.xlsx',
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

  it('runs DK MFN official import with source metadata', async () => {
    await dutiesDkMfnOfficial([
      '--url=https://override.test/dk-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveDkDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/dk-mfn.xlsx',
    });
    expect(mocks.importDkMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/dk-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:dk-mfn-official',
      sourceKey: 'duties.dk.official.mfn_excel',
      sourceUrl: 'https://official.test/dk-mfn.xlsx',
    });
  });

  it('runs both DK official steps for import:duties:dk-all-official', async () => {
    await dutiesDkAllOfficial(['--agreement=fta', '--partner=DK']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:dk-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:dk-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'DK',
        agreement: 'fta',
        partner: 'DK',
        importId: 'run-123',
      })
    );
  });
});
