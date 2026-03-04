import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveHuDutySourceUrlsMock: vi.fn(),
  importHuMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/hu/source-urls.js', () => ({
  HU_MFN_OFFICIAL_SOURCE_KEY: 'duties.hu.official.mfn_excel',
  HU_FTA_OFFICIAL_SOURCE_KEY: 'duties.hu.official.fta_excel',
  resolveHuDutySourceUrls: mocks.resolveHuDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/hu/import-mfn-official.js', () => ({
  importHuMfnOfficial: mocks.importHuMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesHuAllOfficial, dutiesHuMfnOfficial } from './duties-hu.js';

describe('duties-hu commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveHuDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/hu-mfn.xlsx',
      ftaUrl: 'https://official.test/hu-fta.xlsx',
    });
    mocks.importHuMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'hungary-tariff.xlsx',
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

  it('runs HU MFN official import with source metadata', async () => {
    await dutiesHuMfnOfficial([
      '--url=https://override.test/hu-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveHuDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/hu-mfn.xlsx',
    });
    expect(mocks.importHuMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/hu-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:hu-mfn-official',
      sourceKey: 'duties.hu.official.mfn_excel',
      sourceUrl: 'https://official.test/hu-mfn.xlsx',
    });
  });

  it('runs both HU official steps for import:duties:hu-all-official', async () => {
    await dutiesHuAllOfficial(['--agreement=fta', '--partner=HU']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:hu-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:hu-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'HU',
        agreement: 'fta',
        partner: 'HU',
        importId: 'run-123',
      })
    );
  });
});
