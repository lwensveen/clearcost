import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveHrDutySourceUrlsMock: vi.fn(),
  importHrMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/hr/source-urls.js', () => ({
  HR_MFN_OFFICIAL_SOURCE_KEY: 'duties.hr.official.mfn_excel',
  HR_FTA_OFFICIAL_SOURCE_KEY: 'duties.hr.official.fta_excel',
  resolveHrDutySourceUrls: mocks.resolveHrDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/hr/import-mfn-official.js', () => ({
  importHrMfnOfficial: mocks.importHrMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesHrAllOfficial, dutiesHrMfnOfficial } from './duties-hr.js';

describe('duties-hr commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveHrDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/hr-mfn.xlsx',
      ftaUrl: 'https://official.test/hr-fta.xlsx',
    });
    mocks.importHrMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'croatia-tariff.xlsx',
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

  it('runs HR MFN official import with source metadata', async () => {
    await dutiesHrMfnOfficial([
      '--url=https://override.test/hr-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveHrDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/hr-mfn.xlsx',
    });
    expect(mocks.importHrMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/hr-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:hr-mfn-official',
      sourceKey: 'duties.hr.official.mfn_excel',
      sourceUrl: 'https://official.test/hr-mfn.xlsx',
    });
  });

  it('runs both HR official steps for import:duties:hr-all-official', async () => {
    await dutiesHrAllOfficial(['--agreement=fta', '--partner=HR']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:hr-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:hr-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'HR',
        agreement: 'fta',
        partner: 'HR',
        importId: 'run-123',
      })
    );
  });
});
