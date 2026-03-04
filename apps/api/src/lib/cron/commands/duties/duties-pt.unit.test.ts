import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolvePtDutySourceUrlsMock: vi.fn(),
  importPtMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/pt/source-urls.js', () => ({
  PT_MFN_OFFICIAL_SOURCE_KEY: 'duties.pt.official.mfn_excel',
  PT_FTA_OFFICIAL_SOURCE_KEY: 'duties.pt.official.fta_excel',
  resolvePtDutySourceUrls: mocks.resolvePtDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/pt/import-mfn-official.js', () => ({
  importPtMfnOfficial: mocks.importPtMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesPtAllOfficial, dutiesPtMfnOfficial } from './duties-pt.js';

describe('duties-pt commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolvePtDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/pt-mfn.xlsx',
      ftaUrl: 'https://official.test/pt-fta.xlsx',
    });
    mocks.importPtMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'portugal-tariff.xlsx',
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

  it('runs PT MFN official import with source metadata', async () => {
    await dutiesPtMfnOfficial([
      '--url=https://override.test/pt-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolvePtDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/pt-mfn.xlsx',
    });
    expect(mocks.importPtMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/pt-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:pt-mfn-official',
      sourceKey: 'duties.pt.official.mfn_excel',
      sourceUrl: 'https://official.test/pt-mfn.xlsx',
    });
  });

  it('runs both PT official steps for import:duties:pt-all-official', async () => {
    await dutiesPtAllOfficial(['--agreement=fta', '--partner=DE']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:pt-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:pt-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'PT',
        agreement: 'fta',
        partner: 'DE',
        importId: 'run-123',
      })
    );
  });
});
