import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveAgDutySourceUrlsMock: vi.fn(),
  importAgMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/ag/source-urls.js', () => ({
  AG_MFN_OFFICIAL_SOURCE_KEY: 'duties.ag.official.mfn_excel',
  AG_FTA_OFFICIAL_SOURCE_KEY: 'duties.ag.official.fta_excel',
  resolveAgDutySourceUrls: mocks.resolveAgDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/ag/import-mfn-official.js', () => ({
  importAgMfnOfficial: mocks.importAgMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesAgAllOfficial, dutiesAgMfnOfficial } from './duties-ag.js';

describe('duties-ag commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveAgDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/ag-mfn.xlsx',
      ftaUrl: 'https://official.test/ag-fta.xlsx',
    });
    mocks.importAgMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'ag-tariff.xlsx',
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

  it('runs AG MFN official import with source metadata', async () => {
    await dutiesAgMfnOfficial([
      '--url=https://override.test/ag-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveAgDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/ag-mfn.xlsx',
    });
    expect(mocks.importAgMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/ag-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:ag-mfn-official',
      sourceKey: 'duties.ag.official.mfn_excel',
      sourceUrl: 'https://official.test/ag-mfn.xlsx',
    });
  });

  it('runs both AG official steps for import:duties:ag-all-official', async () => {
    await dutiesAgAllOfficial(['--agreement=fta', '--partner=AG']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:ag-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:ag-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'AG',
        agreement: 'fta',
        partner: 'AG',
        importId: 'run-123',
      })
    );
  });
});
