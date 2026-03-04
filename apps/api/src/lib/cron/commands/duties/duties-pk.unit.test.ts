import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolvePkDutySourceUrlsMock: vi.fn(),
  importPkMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/pk/source-urls.js', () => ({
  PK_MFN_OFFICIAL_SOURCE_KEY: 'duties.pk.official.mfn_excel',
  PK_FTA_OFFICIAL_SOURCE_KEY: 'duties.pk.official.fta_excel',
  resolvePkDutySourceUrls: mocks.resolvePkDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/pk/import-mfn-official.js', () => ({
  importPkMfnOfficial: mocks.importPkMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesPkAllOfficial, dutiesPkMfnOfficial } from './duties-pk.js';

describe('duties-pk commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolvePkDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/pk-mfn.xlsx',
      ftaUrl: 'https://official.test/pk-fta.xlsx',
    });
    mocks.importPkMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'pakistan-tariff.xlsx',
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

  it('runs PK MFN official import with source metadata', async () => {
    await dutiesPkMfnOfficial([
      '--url=https://override.test/pk-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolvePkDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/pk-mfn.xlsx',
    });
    expect(mocks.importPkMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/pk-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:pk-mfn-official',
      sourceKey: 'duties.pk.official.mfn_excel',
      sourceUrl: 'https://official.test/pk-mfn.xlsx',
    });
  });

  it('runs both PK official steps for import:duties:pk-all-official', async () => {
    await dutiesPkAllOfficial(['--agreement=fta', '--partner=US']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:pk-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:pk-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'PK',
        agreement: 'fta',
        partner: 'US',
        importId: 'run-123',
      })
    );
  });
});
