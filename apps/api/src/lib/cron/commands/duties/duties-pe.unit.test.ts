import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolvePeDutySourceUrlsMock: vi.fn(),
  importPeMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/pe/source-urls.js', () => ({
  PE_MFN_OFFICIAL_SOURCE_KEY: 'duties.pe.official.mfn_excel',
  PE_FTA_OFFICIAL_SOURCE_KEY: 'duties.pe.official.fta_excel',
  resolvePeDutySourceUrls: mocks.resolvePeDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/pe/import-mfn-official.js', () => ({
  importPeMfnOfficial: mocks.importPeMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesPeAllOfficial, dutiesPeMfnOfficial } from './duties-pe.js';

describe('duties-pe commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolvePeDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/pe-mfn.xlsx',
      ftaUrl: 'https://official.test/pe-fta.xlsx',
    });
    mocks.importPeMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'peru-tariff.xlsx',
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

  it('runs PE MFN official import with source metadata', async () => {
    await dutiesPeMfnOfficial([
      '--url=https://override.test/pe-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolvePeDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/pe-mfn.xlsx',
    });
    expect(mocks.importPeMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/pe-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:pe-mfn-official',
      sourceKey: 'duties.pe.official.mfn_excel',
      sourceUrl: 'https://official.test/pe-mfn.xlsx',
    });
  });

  it('runs both PE official steps for import:duties:pe-all-official', async () => {
    await dutiesPeAllOfficial(['--agreement=fta', '--partner=US']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:pe-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:pe-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'PE',
        agreement: 'fta',
        partner: 'US',
        importId: 'run-123',
      })
    );
  });
});
