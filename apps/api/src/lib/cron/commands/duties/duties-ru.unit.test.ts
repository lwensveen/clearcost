import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveRuDutySourceUrlsMock: vi.fn(),
  importRuMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/ru/source-urls.js', () => ({
  RU_MFN_OFFICIAL_SOURCE_KEY: 'duties.ru.official.mfn_excel',
  RU_FTA_OFFICIAL_SOURCE_KEY: 'duties.ru.official.fta_excel',
  resolveRuDutySourceUrls: mocks.resolveRuDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/ru/import-mfn-official.js', () => ({
  importRuMfnOfficial: mocks.importRuMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesRuAllOfficial, dutiesRuMfnOfficial } from './duties-ru.js';

describe('duties-ru commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveRuDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/ru-mfn.zip',
      ftaUrl: 'https://official.test/ru-fta.xlsx',
    });
    mocks.importRuMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'ru-tariff.xlsx',
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

  it('runs RU MFN official import with source metadata', async () => {
    await dutiesRuMfnOfficial([
      '--url=https://override.test/ru-mfn.zip',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveRuDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/ru-mfn.zip',
    });
    expect(mocks.importRuMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/ru-mfn.zip',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:ru-mfn-official',
      sourceKey: 'duties.ru.official.mfn_excel',
      sourceUrl: 'https://official.test/ru-mfn.zip',
    });
  });

  it('runs both RU official steps for import:duties:ru-all-official', async () => {
    await dutiesRuAllOfficial(['--agreement=eaeu', '--partner=CN']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:ru-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:ru-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'RU',
        agreement: 'eaeu',
        partner: 'CN',
        importId: 'run-123',
      })
    );
  });
});
