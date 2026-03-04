import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveChDutySourceUrlsMock: vi.fn(),
  importChMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/ch/source-urls.js', () => ({
  CH_MFN_OFFICIAL_SOURCE_KEY: 'duties.ch.official.mfn_excel',
  CH_FTA_OFFICIAL_SOURCE_KEY: 'duties.ch.official.fta_excel',
  resolveChDutySourceUrls: mocks.resolveChDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/ch/import-mfn-official.js', () => ({
  importChMfnOfficial: mocks.importChMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesChAllOfficial, dutiesChMfnOfficial } from './duties-ch.js';

describe('duties-ch commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveChDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/ch-mfn.xlsx',
      ftaUrl: 'https://official.test/ch-fta.xlsx',
    });
    mocks.importChMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'swiss-tariff.xlsx',
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

  it('runs CH MFN official import with source metadata', async () => {
    await dutiesChMfnOfficial([
      '--url=https://override.test/ch-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveChDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/ch-mfn.xlsx',
    });
    expect(mocks.importChMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/ch-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:ch-mfn-official',
      sourceKey: 'duties.ch.official.mfn_excel',
      sourceUrl: 'https://official.test/ch-mfn.xlsx',
    });
  });

  it('runs both CH official steps for import:duties:ch-all-official', async () => {
    await dutiesChAllOfficial(['--agreement=efta', '--partner=IS']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:ch-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:ch-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'CH',
        agreement: 'efta',
        partner: 'IS',
        importId: 'run-123',
      })
    );
  });
});
