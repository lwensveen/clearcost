import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveAdDutySourceUrlsMock: vi.fn(),
  resolveAfDutySourceUrlsMock: vi.fn(),
  importAdMfnOfficialMock: vi.fn(),
  importAfMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/ad/import-mfn-official.js', () => ({
  importAdMfnOfficial: mocks.importAdMfnOfficialMock,
}));

vi.mock('../../../../modules/duty-rates/services/af/import-mfn-official.js', () => ({
  importAfMfnOfficial: mocks.importAfMfnOfficialMock,
}));

vi.mock('../../../../modules/duty-rates/services/ad/source-urls.js', () => ({
  AD_MFN_OFFICIAL_SOURCE_KEY: 'duties.ad.official.mfn_excel',
  AD_FTA_OFFICIAL_SOURCE_KEY: 'duties.ad.official.fta_excel',
  resolveAdDutySourceUrls: mocks.resolveAdDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/af/source-urls.js', () => ({
  AF_MFN_OFFICIAL_SOURCE_KEY: 'duties.af.official.mfn_excel',
  AF_FTA_OFFICIAL_SOURCE_KEY: 'duties.af.official.fta_excel',
  resolveAfDutySourceUrls: mocks.resolveAfDutySourceUrlsMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesAdMfnOfficial } from './duties-ad.js';
import { dutiesAfAllOfficial } from './duties-af.js';

describe('duties-country-official-excel commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });

    mocks.resolveAdDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.example/ad.xlsx',
    });
    mocks.resolveAfDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.example/af-mfn.xlsx',
      ftaUrl: 'https://official.example/af-fta.xlsx',
    });

    const okResult = {
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
    };

    mocks.importAdMfnOfficialMock.mockResolvedValue(okResult);
    mocks.importAfMfnOfficialMock.mockResolvedValue(okResult);
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

  it('runs AD MFN official import with source metadata', async () => {
    mocks.resolveAdDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://override.example/ad.xlsx',
    });

    await dutiesAdMfnOfficial([
      '--url=https://override.example/ad.xlsx',
      '--sheet=Tariff',
      '--batchSize=500',
      '--dryRun=1',
    ]);

    expect(mocks.importAdMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://override.example/ad.xlsx',
        sheet: 'Tariff',
        batchSize: 500,
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:ad-mfn-official',
      sourceKey: 'duties.ad.official.mfn_excel',
      sourceUrl: 'https://override.example/ad.xlsx',
    });
  });

  it('runs both AF official steps for import:duties:af-all-official', async () => {
    await dutiesAfAllOfficial(['--agreement=eufta', '--partner=FR']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:af-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:af-fta-official' });
    expect(mocks.importAfMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        importId: 'run-123',
      })
    );
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'AF',
        agreement: 'eufta',
        partner: 'FR',
      })
    );
  });
});
