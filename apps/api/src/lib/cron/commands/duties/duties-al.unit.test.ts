import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveAlDutySourceUrlsMock: vi.fn(),
  importAlMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/al/source-urls.js', () => ({
  AL_MFN_OFFICIAL_SOURCE_KEY: 'duties.al.official.mfn_excel',
  AL_FTA_OFFICIAL_SOURCE_KEY: 'duties.al.official.fta_excel',
  resolveAlDutySourceUrls: mocks.resolveAlDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/al/import-mfn-official.js', () => ({
  importAlMfnOfficial: mocks.importAlMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesAlAllOfficial, dutiesAlMfnOfficial } from './duties-al.js';

describe('duties-al commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveAlDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/al-mfn.xlsx',
      ftaUrl: 'https://official.test/al-fta.xlsx',
    });
    mocks.importAlMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'al-tariff.xlsx',
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

  it('runs AL MFN official import with source metadata', async () => {
    await dutiesAlMfnOfficial([
      '--url=https://override.test/al-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveAlDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/al-mfn.xlsx',
    });
    expect(mocks.importAlMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/al-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:al-mfn-official',
      sourceKey: 'duties.al.official.mfn_excel',
      sourceUrl: 'https://official.test/al-mfn.xlsx',
    });
  });

  it('runs both AL official steps for import:duties:al-all-official', async () => {
    await dutiesAlAllOfficial(['--agreement=fta', '--partner=AL']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:al-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:al-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'AL',
        agreement: 'fta',
        partner: 'AL',
        importId: 'run-123',
      })
    );
  });
});
