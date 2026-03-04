import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveEgDutySourceUrlsMock: vi.fn(),
  importEgMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/eg/source-urls.js', () => ({
  EG_MFN_OFFICIAL_SOURCE_KEY: 'duties.eg.official.mfn_excel',
  EG_FTA_OFFICIAL_SOURCE_KEY: 'duties.eg.official.fta_excel',
  resolveEgDutySourceUrls: mocks.resolveEgDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/eg/import-mfn-official.js', () => ({
  importEgMfnOfficial: mocks.importEgMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesEgAllOfficial, dutiesEgMfnOfficial } from './duties-eg.js';

describe('duties-eg commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveEgDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/eg-mfn.xlsx',
      ftaUrl: 'https://official.test/eg-fta.xlsx',
    });
    mocks.importEgMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'egypt-tariff.xlsx',
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

  it('runs EG MFN official import with source metadata', async () => {
    await dutiesEgMfnOfficial([
      '--url=https://override.test/eg-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveEgDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/eg-mfn.xlsx',
    });
    expect(mocks.importEgMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/eg-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:eg-mfn-official',
      sourceKey: 'duties.eg.official.mfn_excel',
      sourceUrl: 'https://official.test/eg-mfn.xlsx',
    });
  });

  it('runs both EG official steps for import:duties:eg-all-official', async () => {
    await dutiesEgAllOfficial(['--agreement=fta', '--partner=EG']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:eg-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:eg-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'EG',
        agreement: 'fta',
        partner: 'EG',
        importId: 'run-123',
      })
    );
  });
});
