import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveCoDutySourceUrlsMock: vi.fn(),
  importCoMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/co/source-urls.js', () => ({
  CO_MFN_OFFICIAL_SOURCE_KEY: 'duties.co.official.mfn_excel',
  CO_FTA_OFFICIAL_SOURCE_KEY: 'duties.co.official.fta_excel',
  resolveCoDutySourceUrls: mocks.resolveCoDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/co/import-mfn-official.js', () => ({
  importCoMfnOfficial: mocks.importCoMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesCoAllOfficial, dutiesCoMfnOfficial } from './duties-co.js';

describe('duties-co commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveCoDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/co-mfn.zip',
      ftaUrl: 'https://official.test/co-fta.xlsx',
    });
    mocks.importCoMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'co-tariff.xlsx',
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

  it('runs CO MFN official import with source metadata', async () => {
    await dutiesCoMfnOfficial([
      '--url=https://override.test/co-mfn.zip',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveCoDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/co-mfn.zip',
    });
    expect(mocks.importCoMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/co-mfn.zip',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:co-mfn-official',
      sourceKey: 'duties.co.official.mfn_excel',
      sourceUrl: 'https://official.test/co-mfn.zip',
    });
  });

  it('runs both CO official steps for import:duties:co-all-official', async () => {
    await dutiesCoAllOfficial(['--agreement=andean', '--partner=PE']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:co-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:co-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'CO',
        agreement: 'andean',
        partner: 'PE',
        importId: 'run-123',
      })
    );
  });
});
