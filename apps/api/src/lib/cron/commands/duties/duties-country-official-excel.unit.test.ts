import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveSourceDownloadUrlMock: vi.fn(),
  importMfnExcelMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-mfn-official-excel.js',
  () => ({
    importAseanMfnOfficialFromExcel: mocks.importMfnExcelMock,
  })
);

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesAuMfnOfficial } from './duties-au.js';
import { dutiesMxAllOfficial } from './duties-mx.js';

describe('duties-country-official-excel commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    delete process.env.AU_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.MX_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.MX_FTA_OFFICIAL_EXCEL_URL;

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });

    mocks.resolveSourceDownloadUrlMock.mockResolvedValue('https://official.example/rates.xlsx');
    mocks.importMfnExcelMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
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
      '--url=https://override.example/au.xlsx',
      '--sheet=Tariff',
      '--batchSize=500',
      '--dryRun=1',
    ]);

    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: 'duties.au.official.mfn_excel',
      fallbackUrl: 'https://override.example/au.xlsx',
    });
    expect(mocks.importMfnExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'AU',
        urlOrPath: 'https://official.example/rates.xlsx',
        sheet: 'Tariff',
        batchSize: 500,
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:au-mfn-official',
      sourceKey: 'duties.au.official.mfn_excel',
      sourceUrl: 'https://official.example/rates.xlsx',
    });
  });

  it('runs both MX official steps for import:duties:mx-all-official', async () => {
    process.env.MX_MFN_OFFICIAL_EXCEL_URL = 'https://env.example/mx-mfn.xlsx';
    process.env.MX_FTA_OFFICIAL_EXCEL_URL = 'https://env.example/mx-fta.xlsx';

    await dutiesMxAllOfficial(['--agreement=usmca', '--partner=US']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:mx-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:mx-fta-official' });
    expect(mocks.importMfnExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'MX',
      })
    );
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'MX',
        agreement: 'usmca',
        partner: 'US',
      })
    );
  });
});
