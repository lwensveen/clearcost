import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveIlDutySourceUrlsMock: vi.fn(),
  importIlMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/il/source-urls.js', () => ({
  IL_MFN_OFFICIAL_SOURCE_KEY: 'duties.il.official.mfn_excel',
  IL_FTA_OFFICIAL_SOURCE_KEY: 'duties.il.official.fta_excel',
  resolveIlDutySourceUrls: mocks.resolveIlDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/il/import-mfn-official.js', () => ({
  importIlMfnOfficial: mocks.importIlMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesIlAllOfficial, dutiesIlMfnOfficial } from './duties-il.js';

describe('duties-il commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveIlDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/il-mfn.zip',
      ftaUrl: 'https://official.test/il-fta.xlsx',
    });
    mocks.importIlMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'il-tariff.xlsx',
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

  it('runs IL MFN official import with source metadata', async () => {
    await dutiesIlMfnOfficial([
      '--url=https://override.test/il-mfn.zip',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveIlDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/il-mfn.zip',
    });
    expect(mocks.importIlMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/il-mfn.zip',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:il-mfn-official',
      sourceKey: 'duties.il.official.mfn_excel',
      sourceUrl: 'https://official.test/il-mfn.zip',
    });
  });

  it('runs both IL official steps for import:duties:il-all-official', async () => {
    await dutiesIlAllOfficial(['--agreement=fta-il-us', '--partner=US']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:il-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:il-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'IL',
        agreement: 'fta-il-us',
        partner: 'US',
        importId: 'run-123',
      })
    );
  });
});
