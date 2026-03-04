import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveNzDutySourceUrlsMock: vi.fn(),
  importNzMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/nz/source-urls.js', () => ({
  NZ_MFN_OFFICIAL_SOURCE_KEY: 'duties.nz.official.mfn_excel',
  NZ_FTA_OFFICIAL_SOURCE_KEY: 'duties.nz.official.fta_excel',
  resolveNzDutySourceUrls: mocks.resolveNzDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/nz/import-mfn-official.js', () => ({
  importNzMfnOfficial: mocks.importNzMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesNzAllOfficial, dutiesNzMfnOfficial } from './duties-nz.js';

describe('duties-nz commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveNzDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/nz-mfn.tar.gz',
      ftaUrl: 'https://official.test/nz-fta.xlsx',
    });
    mocks.importNzMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: '01-99-2026.xlsx',
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

  it('runs NZ MFN official import with source metadata', async () => {
    await dutiesNzMfnOfficial([
      '--url=https://override.test/nz-mfn.tar.gz',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveNzDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/nz-mfn.tar.gz',
    });
    expect(mocks.importNzMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/nz-mfn.tar.gz',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:nz-mfn-official',
      sourceKey: 'duties.nz.official.mfn_excel',
      sourceUrl: 'https://official.test/nz-mfn.tar.gz',
    });
  });

  it('runs both NZ official steps for import:duties:nz-all-official', async () => {
    await dutiesNzAllOfficial(['--agreement=anzcerta', '--partner=AU']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:nz-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:nz-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'NZ',
        agreement: 'anzcerta',
        partner: 'AU',
        importId: 'run-123',
      })
    );
  });
});
