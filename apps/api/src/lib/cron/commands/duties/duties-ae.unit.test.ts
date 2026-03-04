import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveAeDutySourceUrlsMock: vi.fn(),
  importAeMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/ae/source-urls.js', () => ({
  AE_MFN_OFFICIAL_SOURCE_KEY: 'duties.ae.official.mfn_excel',
  AE_FTA_OFFICIAL_SOURCE_KEY: 'duties.ae.official.fta_excel',
  resolveAeDutySourceUrls: mocks.resolveAeDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/ae/import-mfn-official.js', () => ({
  importAeMfnOfficial: mocks.importAeMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesAeAllOfficial, dutiesAeMfnOfficial } from './duties-ae.js';

describe('duties-ae commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveAeDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/ae-mfn.xlsx',
      ftaUrl: 'https://official.test/ae-fta.xlsx',
    });
    mocks.importAeMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'uae-tariff.xlsx',
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

  it('runs AE MFN official import with source metadata', async () => {
    await dutiesAeMfnOfficial([
      '--url=https://override.test/ae-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveAeDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/ae-mfn.xlsx',
    });
    expect(mocks.importAeMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/ae-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:ae-mfn-official',
      sourceKey: 'duties.ae.official.mfn_excel',
      sourceUrl: 'https://official.test/ae-mfn.xlsx',
    });
  });

  it('runs both AE official steps for import:duties:ae-all-official', async () => {
    await dutiesAeAllOfficial(['--agreement=fta', '--partner=AE']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:ae-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:ae-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'AE',
        agreement: 'fta',
        partner: 'AE',
        importId: 'run-123',
      })
    );
  });
});
