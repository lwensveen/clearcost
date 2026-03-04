import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveClDutySourceUrlsMock: vi.fn(),
  importClMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/cl/source-urls.js', () => ({
  CL_MFN_OFFICIAL_SOURCE_KEY: 'duties.cl.official.mfn_excel',
  CL_FTA_OFFICIAL_SOURCE_KEY: 'duties.cl.official.fta_excel',
  resolveClDutySourceUrls: mocks.resolveClDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/cl/import-mfn-official.js', () => ({
  importClMfnOfficial: mocks.importClMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesClAllOfficial, dutiesClMfnOfficial } from './duties-cl.js';

describe('duties-cl commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveClDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/cl-mfn.xlsx',
      ftaUrl: 'https://official.test/cl-fta.xlsx',
    });
    mocks.importClMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'chile-tariff.xlsx',
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

  it('runs CL MFN official import with source metadata', async () => {
    await dutiesClMfnOfficial([
      '--url=https://override.test/cl-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveClDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/cl-mfn.xlsx',
    });
    expect(mocks.importClMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/cl-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:cl-mfn-official',
      sourceKey: 'duties.cl.official.mfn_excel',
      sourceUrl: 'https://official.test/cl-mfn.xlsx',
    });
  });

  it('runs both CL official steps for import:duties:cl-all-official', async () => {
    await dutiesClAllOfficial(['--agreement=fta', '--partner=US']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:cl-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:cl-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'CL',
        agreement: 'fta',
        partner: 'US',
        importId: 'run-123',
      })
    );
  });
});
