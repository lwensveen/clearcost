import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveItDutySourceUrlsMock: vi.fn(),
  importItMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/it/source-urls.js', () => ({
  IT_MFN_OFFICIAL_SOURCE_KEY: 'duties.it.official.mfn_excel',
  IT_FTA_OFFICIAL_SOURCE_KEY: 'duties.it.official.fta_excel',
  resolveItDutySourceUrls: mocks.resolveItDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/it/import-mfn-official.js', () => ({
  importItMfnOfficial: mocks.importItMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesItAllOfficial, dutiesItMfnOfficial } from './duties-it.js';

describe('duties-it commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveItDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/it-mfn.xlsx',
      ftaUrl: 'https://official.test/it-fta.xlsx',
    });
    mocks.importItMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'italy-tariff.xlsx',
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

  it('runs IT MFN official import with source metadata', async () => {
    await dutiesItMfnOfficial([
      '--url=https://override.test/it-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveItDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/it-mfn.xlsx',
    });
    expect(mocks.importItMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/it-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:it-mfn-official',
      sourceKey: 'duties.it.official.mfn_excel',
      sourceUrl: 'https://official.test/it-mfn.xlsx',
    });
  });

  it('runs both IT official steps for import:duties:it-all-official', async () => {
    await dutiesItAllOfficial(['--agreement=fta', '--partner=IT']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:it-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:it-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'IT',
        agreement: 'fta',
        partner: 'IT',
        importId: 'run-123',
      })
    );
  });
});
