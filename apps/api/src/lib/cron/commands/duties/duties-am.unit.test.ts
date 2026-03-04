import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveAmDutySourceUrlsMock: vi.fn(),
  importAmMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/am/source-urls.js', () => ({
  AM_MFN_OFFICIAL_SOURCE_KEY: 'duties.am.official.mfn_excel',
  AM_FTA_OFFICIAL_SOURCE_KEY: 'duties.am.official.fta_excel',
  resolveAmDutySourceUrls: mocks.resolveAmDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/am/import-mfn-official.js', () => ({
  importAmMfnOfficial: mocks.importAmMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesAmAllOfficial, dutiesAmMfnOfficial } from './duties-am.js';

describe('duties-am commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveAmDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/am-mfn.xlsx',
      ftaUrl: 'https://official.test/am-fta.xlsx',
    });
    mocks.importAmMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'am-tariff.xlsx',
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

  it('runs AM MFN official import with source metadata', async () => {
    await dutiesAmMfnOfficial([
      '--url=https://override.test/am-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveAmDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/am-mfn.xlsx',
    });
    expect(mocks.importAmMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/am-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:am-mfn-official',
      sourceKey: 'duties.am.official.mfn_excel',
      sourceUrl: 'https://official.test/am-mfn.xlsx',
    });
  });

  it('runs both AM official steps for import:duties:am-all-official', async () => {
    await dutiesAmAllOfficial(['--agreement=fta', '--partner=AM']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:am-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:am-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'AM',
        agreement: 'fta',
        partner: 'AM',
        importId: 'run-123',
      })
    );
  });
});
