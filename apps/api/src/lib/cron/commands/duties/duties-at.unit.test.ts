import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveAtDutySourceUrlsMock: vi.fn(),
  importAtMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/at/source-urls.js', () => ({
  AT_MFN_OFFICIAL_SOURCE_KEY: 'duties.at.official.mfn_excel',
  AT_FTA_OFFICIAL_SOURCE_KEY: 'duties.at.official.fta_excel',
  resolveAtDutySourceUrls: mocks.resolveAtDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/at/import-mfn-official.js', () => ({
  importAtMfnOfficial: mocks.importAtMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesAtAllOfficial, dutiesAtMfnOfficial } from './duties-at.js';

describe('duties-at commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveAtDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/at-mfn.xlsx',
      ftaUrl: 'https://official.test/at-fta.xlsx',
    });
    mocks.importAtMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'austria-tariff.xlsx',
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

  it('runs AT MFN official import with source metadata', async () => {
    await dutiesAtMfnOfficial([
      '--url=https://override.test/at-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveAtDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/at-mfn.xlsx',
    });
    expect(mocks.importAtMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/at-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:at-mfn-official',
      sourceKey: 'duties.at.official.mfn_excel',
      sourceUrl: 'https://official.test/at-mfn.xlsx',
    });
  });

  it('runs both AT official steps for import:duties:at-all-official', async () => {
    await dutiesAtAllOfficial(['--agreement=fta', '--partner=AT']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:at-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:at-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'AT',
        agreement: 'fta',
        partner: 'AT',
        importId: 'run-123',
      })
    );
  });
});
