import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveDeDutySourceUrlsMock: vi.fn(),
  importDeMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/de/source-urls.js', () => ({
  DE_MFN_OFFICIAL_SOURCE_KEY: 'duties.de.official.mfn_excel',
  DE_FTA_OFFICIAL_SOURCE_KEY: 'duties.de.official.fta_excel',
  resolveDeDutySourceUrls: mocks.resolveDeDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/de/import-mfn-official.js', () => ({
  importDeMfnOfficial: mocks.importDeMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesDeAllOfficial, dutiesDeMfnOfficial } from './duties-de.js';

describe('duties-de commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveDeDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/de-mfn.xlsx',
      ftaUrl: 'https://official.test/de-fta.xlsx',
    });
    mocks.importDeMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'germany-tariff.xlsx',
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

  it('runs DE MFN official import with source metadata', async () => {
    await dutiesDeMfnOfficial([
      '--url=https://override.test/de-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveDeDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/de-mfn.xlsx',
    });
    expect(mocks.importDeMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/de-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:de-mfn-official',
      sourceKey: 'duties.de.official.mfn_excel',
      sourceUrl: 'https://official.test/de-mfn.xlsx',
    });
  });

  it('runs both DE official steps for import:duties:de-all-official', async () => {
    await dutiesDeAllOfficial(['--agreement=fta', '--partner=IT']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:de-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:de-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'DE',
        agreement: 'fta',
        partner: 'IT',
        importId: 'run-123',
      })
    );
  });
});
