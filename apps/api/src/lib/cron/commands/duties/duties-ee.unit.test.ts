import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveEeDutySourceUrlsMock: vi.fn(),
  importEeMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/ee/source-urls.js', () => ({
  EE_MFN_OFFICIAL_SOURCE_KEY: 'duties.ee.official.mfn_excel',
  EE_FTA_OFFICIAL_SOURCE_KEY: 'duties.ee.official.fta_excel',
  resolveEeDutySourceUrls: mocks.resolveEeDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/ee/import-mfn-official.js', () => ({
  importEeMfnOfficial: mocks.importEeMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesEeAllOfficial, dutiesEeMfnOfficial } from './duties-ee.js';

describe('duties-ee commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveEeDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/ee-mfn.xlsx',
      ftaUrl: 'https://official.test/ee-fta.xlsx',
    });
    mocks.importEeMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'estonia-tariff.xlsx',
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

  it('runs EE MFN official import with source metadata', async () => {
    await dutiesEeMfnOfficial([
      '--url=https://override.test/ee-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveEeDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/ee-mfn.xlsx',
    });
    expect(mocks.importEeMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/ee-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:ee-mfn-official',
      sourceKey: 'duties.ee.official.mfn_excel',
      sourceUrl: 'https://official.test/ee-mfn.xlsx',
    });
  });

  it('runs both EE official steps for import:duties:ee-all-official', async () => {
    await dutiesEeAllOfficial(['--agreement=fta', '--partner=EE']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:ee-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:ee-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'EE',
        agreement: 'fta',
        partner: 'EE',
        importId: 'run-123',
      })
    );
  });
});
