import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveAqDutySourceUrlsMock: vi.fn(),
  importAqMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/aq/source-urls.js', () => ({
  AQ_MFN_OFFICIAL_SOURCE_KEY: 'duties.aq.official.mfn_excel',
  AQ_FTA_OFFICIAL_SOURCE_KEY: 'duties.aq.official.fta_excel',
  resolveAqDutySourceUrls: mocks.resolveAqDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/aq/import-mfn-official.js', () => ({
  importAqMfnOfficial: mocks.importAqMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesAqAllOfficial, dutiesAqMfnOfficial } from './duties-aq.js';

describe('duties-aq commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveAqDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/aq-mfn.xlsx',
      ftaUrl: 'https://official.test/aq-fta.xlsx',
    });
    mocks.importAqMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'aq-tariff.xlsx',
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

  it('runs AQ MFN official import with source metadata', async () => {
    await dutiesAqMfnOfficial([
      '--url=https://override.test/aq-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveAqDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/aq-mfn.xlsx',
    });
    expect(mocks.importAqMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/aq-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:aq-mfn-official',
      sourceKey: 'duties.aq.official.mfn_excel',
      sourceUrl: 'https://official.test/aq-mfn.xlsx',
    });
  });

  it('runs both AQ official steps for import:duties:aq-all-official', async () => {
    await dutiesAqAllOfficial(['--agreement=fta', '--partner=AQ']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:aq-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:aq-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'AQ',
        agreement: 'fta',
        partner: 'AQ',
        importId: 'run-123',
      })
    );
  });
});
