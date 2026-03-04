import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveAoDutySourceUrlsMock: vi.fn(),
  importAoMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/ao/source-urls.js', () => ({
  AO_MFN_OFFICIAL_SOURCE_KEY: 'duties.ao.official.mfn_excel',
  AO_FTA_OFFICIAL_SOURCE_KEY: 'duties.ao.official.fta_excel',
  resolveAoDutySourceUrls: mocks.resolveAoDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/ao/import-mfn-official.js', () => ({
  importAoMfnOfficial: mocks.importAoMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesAoAllOfficial, dutiesAoMfnOfficial } from './duties-ao.js';

describe('duties-ao commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveAoDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/ao-mfn.xlsx',
      ftaUrl: 'https://official.test/ao-fta.xlsx',
    });
    mocks.importAoMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'ao-tariff.xlsx',
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

  it('runs AO MFN official import with source metadata', async () => {
    await dutiesAoMfnOfficial([
      '--url=https://override.test/ao-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveAoDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/ao-mfn.xlsx',
    });
    expect(mocks.importAoMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/ao-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:ao-mfn-official',
      sourceKey: 'duties.ao.official.mfn_excel',
      sourceUrl: 'https://official.test/ao-mfn.xlsx',
    });
  });

  it('runs both AO official steps for import:duties:ao-all-official', async () => {
    await dutiesAoAllOfficial(['--agreement=fta', '--partner=AO']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:ao-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:ao-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'AO',
        agreement: 'fta',
        partner: 'AO',
        importId: 'run-123',
      })
    );
  });
});
