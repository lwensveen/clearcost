import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveUaDutySourceUrlsMock: vi.fn(),
  importUaMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/ua/source-urls.js', () => ({
  UA_MFN_OFFICIAL_SOURCE_KEY: 'duties.ua.official.mfn_excel',
  UA_FTA_OFFICIAL_SOURCE_KEY: 'duties.ua.official.fta_excel',
  resolveUaDutySourceUrls: mocks.resolveUaDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/ua/import-mfn-official.js', () => ({
  importUaMfnOfficial: mocks.importUaMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesUaAllOfficial, dutiesUaMfnOfficial } from './duties-ua.js';

describe('duties-ua commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveUaDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/ua-mfn.xlsx',
      ftaUrl: 'https://official.test/ua-fta.xlsx',
    });
    mocks.importUaMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'ukraine-tariff.xlsx',
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

  it('runs UA MFN official import with source metadata', async () => {
    await dutiesUaMfnOfficial([
      '--url=https://override.test/ua-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveUaDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/ua-mfn.xlsx',
    });
    expect(mocks.importUaMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/ua-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:ua-mfn-official',
      sourceKey: 'duties.ua.official.mfn_excel',
      sourceUrl: 'https://official.test/ua-mfn.xlsx',
    });
  });

  it('runs both UA official steps for import:duties:ua-all-official', async () => {
    await dutiesUaAllOfficial(['--agreement=fta', '--partner=UA']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:ua-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:ua-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'UA',
        agreement: 'fta',
        partner: 'UA',
        importId: 'run-123',
      })
    );
  });
});
