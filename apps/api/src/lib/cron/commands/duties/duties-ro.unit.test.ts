import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveRoDutySourceUrlsMock: vi.fn(),
  importRoMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/ro/source-urls.js', () => ({
  RO_MFN_OFFICIAL_SOURCE_KEY: 'duties.ro.official.mfn_excel',
  RO_FTA_OFFICIAL_SOURCE_KEY: 'duties.ro.official.fta_excel',
  resolveRoDutySourceUrls: mocks.resolveRoDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/ro/import-mfn-official.js', () => ({
  importRoMfnOfficial: mocks.importRoMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesRoAllOfficial, dutiesRoMfnOfficial } from './duties-ro.js';

describe('duties-ro commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveRoDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/ro-mfn.xlsx',
      ftaUrl: 'https://official.test/ro-fta.xlsx',
    });
    mocks.importRoMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'romania-tariff.xlsx',
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

  it('runs RO MFN official import with source metadata', async () => {
    await dutiesRoMfnOfficial([
      '--url=https://override.test/ro-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveRoDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/ro-mfn.xlsx',
    });
    expect(mocks.importRoMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/ro-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:ro-mfn-official',
      sourceKey: 'duties.ro.official.mfn_excel',
      sourceUrl: 'https://official.test/ro-mfn.xlsx',
    });
  });

  it('runs both RO official steps for import:duties:ro-all-official', async () => {
    await dutiesRoAllOfficial(['--agreement=fta', '--partner=RO']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:ro-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:ro-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'RO',
        agreement: 'fta',
        partner: 'RO',
        importId: 'run-123',
      })
    );
  });
});
