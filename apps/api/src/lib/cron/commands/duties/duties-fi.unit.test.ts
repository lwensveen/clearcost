import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveFiDutySourceUrlsMock: vi.fn(),
  importFiMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/fi/source-urls.js', () => ({
  FI_MFN_OFFICIAL_SOURCE_KEY: 'duties.fi.official.mfn_excel',
  FI_FTA_OFFICIAL_SOURCE_KEY: 'duties.fi.official.fta_excel',
  resolveFiDutySourceUrls: mocks.resolveFiDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/fi/import-mfn-official.js', () => ({
  importFiMfnOfficial: mocks.importFiMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesFiAllOfficial, dutiesFiMfnOfficial } from './duties-fi.js';

describe('duties-fi commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveFiDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/fi-mfn.xlsx',
      ftaUrl: 'https://official.test/fi-fta.xlsx',
    });
    mocks.importFiMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'finland-tariff.xlsx',
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

  it('runs FI MFN official import with source metadata', async () => {
    await dutiesFiMfnOfficial([
      '--url=https://override.test/fi-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveFiDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/fi-mfn.xlsx',
    });
    expect(mocks.importFiMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/fi-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:fi-mfn-official',
      sourceKey: 'duties.fi.official.mfn_excel',
      sourceUrl: 'https://official.test/fi-mfn.xlsx',
    });
  });

  it('runs both FI official steps for import:duties:fi-all-official', async () => {
    await dutiesFiAllOfficial(['--agreement=fta', '--partner=FI']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:fi-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:fi-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'FI',
        agreement: 'fta',
        partner: 'FI',
        importId: 'run-123',
      })
    );
  });
});
