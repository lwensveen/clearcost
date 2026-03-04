import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveIsDutySourceUrlsMock: vi.fn(),
  importIsMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/is/source-urls.js', () => ({
  IS_MFN_OFFICIAL_SOURCE_KEY: 'duties.is.official.mfn_excel',
  IS_FTA_OFFICIAL_SOURCE_KEY: 'duties.is.official.fta_excel',
  resolveIsDutySourceUrls: mocks.resolveIsDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/is/import-mfn-official.js', () => ({
  importIsMfnOfficial: mocks.importIsMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesIsAllOfficial, dutiesIsMfnOfficial } from './duties-is.js';

describe('duties-is commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveIsDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/is-mfn.xlsx',
      ftaUrl: 'https://official.test/is-fta.xlsx',
    });
    mocks.importIsMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'iceland-tariff.xlsx',
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

  it('runs IS MFN official import with source metadata', async () => {
    await dutiesIsMfnOfficial([
      '--url=https://override.test/is-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveIsDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/is-mfn.xlsx',
    });
    expect(mocks.importIsMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/is-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:is-mfn-official',
      sourceKey: 'duties.is.official.mfn_excel',
      sourceUrl: 'https://official.test/is-mfn.xlsx',
    });
  });

  it('runs both IS official steps for import:duties:is-all-official', async () => {
    await dutiesIsAllOfficial(['--agreement=efta', '--partner=NO']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:is-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:is-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'IS',
        agreement: 'efta',
        partner: 'NO',
        importId: 'run-123',
      })
    );
  });
});
