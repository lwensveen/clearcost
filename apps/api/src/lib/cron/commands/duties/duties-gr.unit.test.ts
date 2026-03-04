import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveGrDutySourceUrlsMock: vi.fn(),
  importGrMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/gr/source-urls.js', () => ({
  GR_MFN_OFFICIAL_SOURCE_KEY: 'duties.gr.official.mfn_excel',
  GR_FTA_OFFICIAL_SOURCE_KEY: 'duties.gr.official.fta_excel',
  resolveGrDutySourceUrls: mocks.resolveGrDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/gr/import-mfn-official.js', () => ({
  importGrMfnOfficial: mocks.importGrMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesGrAllOfficial, dutiesGrMfnOfficial } from './duties-gr.js';

describe('duties-gr commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveGrDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/gr-mfn.xlsx',
      ftaUrl: 'https://official.test/gr-fta.xlsx',
    });
    mocks.importGrMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'greece-tariff.xlsx',
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

  it('runs GR MFN official import with source metadata', async () => {
    await dutiesGrMfnOfficial([
      '--url=https://override.test/gr-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveGrDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/gr-mfn.xlsx',
    });
    expect(mocks.importGrMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/gr-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:gr-mfn-official',
      sourceKey: 'duties.gr.official.mfn_excel',
      sourceUrl: 'https://official.test/gr-mfn.xlsx',
    });
  });

  it('runs both GR official steps for import:duties:gr-all-official', async () => {
    await dutiesGrAllOfficial(['--agreement=fta', '--partner=GR']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:gr-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:gr-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'GR',
        agreement: 'fta',
        partner: 'GR',
        importId: 'run-123',
      })
    );
  });
});
