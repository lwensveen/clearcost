import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveAwDutySourceUrlsMock: vi.fn(),
  importAwMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/aw/source-urls.js', () => ({
  AW_MFN_OFFICIAL_SOURCE_KEY: 'duties.aw.official.mfn_excel',
  AW_FTA_OFFICIAL_SOURCE_KEY: 'duties.aw.official.fta_excel',
  resolveAwDutySourceUrls: mocks.resolveAwDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/aw/import-mfn-official.js', () => ({
  importAwMfnOfficial: mocks.importAwMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesAwAllOfficial, dutiesAwMfnOfficial } from './duties-aw.js';

describe('duties-aw commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveAwDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/aw-mfn.xlsx',
      ftaUrl: 'https://official.test/aw-fta.xlsx',
    });
    mocks.importAwMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'aw-tariff.xlsx',
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

  it('runs AW MFN official import with source metadata', async () => {
    await dutiesAwMfnOfficial([
      '--url=https://override.test/aw-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveAwDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/aw-mfn.xlsx',
    });
    expect(mocks.importAwMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/aw-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:aw-mfn-official',
      sourceKey: 'duties.aw.official.mfn_excel',
      sourceUrl: 'https://official.test/aw-mfn.xlsx',
    });
  });

  it('runs both AW official steps for import:duties:aw-all-official', async () => {
    await dutiesAwAllOfficial(['--agreement=fta', '--partner=AW']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:aw-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:aw-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'AW',
        agreement: 'fta',
        partner: 'AW',
        importId: 'run-123',
      })
    );
  });
});
