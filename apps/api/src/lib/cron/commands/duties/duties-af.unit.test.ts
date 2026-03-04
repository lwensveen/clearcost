import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveAfDutySourceUrlsMock: vi.fn(),
  importAfMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/af/source-urls.js', () => ({
  AF_MFN_OFFICIAL_SOURCE_KEY: 'duties.af.official.mfn_excel',
  AF_FTA_OFFICIAL_SOURCE_KEY: 'duties.af.official.fta_excel',
  resolveAfDutySourceUrls: mocks.resolveAfDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/af/import-mfn-official.js', () => ({
  importAfMfnOfficial: mocks.importAfMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesAfAllOfficial, dutiesAfMfnOfficial } from './duties-af.js';

describe('duties-af commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveAfDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/af-mfn.xlsx',
      ftaUrl: 'https://official.test/af-fta.xlsx',
    });
    mocks.importAfMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'af-tariff.xlsx',
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

  it('runs AF MFN official import with source metadata', async () => {
    await dutiesAfMfnOfficial([
      '--url=https://override.test/af-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveAfDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/af-mfn.xlsx',
    });
    expect(mocks.importAfMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/af-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:af-mfn-official',
      sourceKey: 'duties.af.official.mfn_excel',
      sourceUrl: 'https://official.test/af-mfn.xlsx',
    });
  });

  it('runs both AF official steps for import:duties:af-all-official', async () => {
    await dutiesAfAllOfficial(['--agreement=fta', '--partner=AF']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:af-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:af-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'AF',
        agreement: 'fta',
        partner: 'AF',
        importId: 'run-123',
      })
    );
  });
});
