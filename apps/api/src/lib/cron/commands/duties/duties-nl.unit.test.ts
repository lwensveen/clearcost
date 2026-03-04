import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveNlDutySourceUrlsMock: vi.fn(),
  importNlMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/nl/source-urls.js', () => ({
  NL_MFN_OFFICIAL_SOURCE_KEY: 'duties.nl.official.mfn_excel',
  NL_FTA_OFFICIAL_SOURCE_KEY: 'duties.nl.official.fta_excel',
  resolveNlDutySourceUrls: mocks.resolveNlDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/nl/import-mfn-official.js', () => ({
  importNlMfnOfficial: mocks.importNlMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesNlAllOfficial, dutiesNlMfnOfficial } from './duties-nl.js';

describe('duties-nl commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveNlDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/nl-mfn.xlsx',
      ftaUrl: 'https://official.test/nl-fta.xlsx',
    });
    mocks.importNlMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'netherlands-tariff.xlsx',
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

  it('runs NL MFN official import with source metadata', async () => {
    await dutiesNlMfnOfficial([
      '--url=https://override.test/nl-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveNlDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/nl-mfn.xlsx',
    });
    expect(mocks.importNlMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/nl-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:nl-mfn-official',
      sourceKey: 'duties.nl.official.mfn_excel',
      sourceUrl: 'https://official.test/nl-mfn.xlsx',
    });
  });

  it('runs both NL official steps for import:duties:nl-all-official', async () => {
    await dutiesNlAllOfficial(['--agreement=fta', '--partner=NL']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:nl-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:nl-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'NL',
        agreement: 'fta',
        partner: 'NL',
        importId: 'run-123',
      })
    );
  });
});
