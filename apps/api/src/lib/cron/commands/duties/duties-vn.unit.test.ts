import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveAseanDutySourceUrlMock: vi.fn(),
  importAseanMfnOfficialFromExcelMock: vi.fn(),
  importAseanPreferentialOfficialFromExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/asean/source-urls.js', () => ({
  resolveAseanDutySourceUrl: mocks.resolveAseanDutySourceUrlMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-mfn-official-excel.js',
  () => ({
    importAseanMfnOfficialFromExcel: mocks.importAseanMfnOfficialFromExcelMock,
  })
);

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importAseanPreferentialOfficialFromExcelMock,
  })
);

import { dutiesVnAllOfficial, dutiesVnFtaOfficial } from './duties-vn.js';

describe('duties-vn commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveAseanDutySourceUrlMock.mockResolvedValue('https://example.com/vn.xlsx');
    mocks.importAseanMfnOfficialFromExcelMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
    });
    mocks.importAseanPreferentialOfficialFromExcelMock.mockResolvedValue({
      ok: true,
      inserted: 3,
      updated: 0,
      count: 3,
    });
  });

  it('runs VN FTA official import with official source metadata', async () => {
    await dutiesVnFtaOfficial([
      '--url=https://seed.example/vn-fta.xlsx',
      '--sheet=1',
      '--partner=SG',
      '--agreement=ATIGA',
      '--dryRun=1',
    ]);

    expect(mocks.resolveAseanDutySourceUrlMock).toHaveBeenCalledWith({
      sourceKey: 'duties.vn.official.fta_excel',
      fallbackUrl: 'https://seed.example/vn-fta.xlsx',
    });
    expect(mocks.importAseanPreferentialOfficialFromExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'VN',
        urlOrPath: 'https://example.com/vn.xlsx',
        sheet: 1,
        partner: 'SG',
        agreement: 'ATIGA',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:vn-fta-official',
      sourceKey: 'duties.vn.official.fta_excel',
    });
  });

  it('runs both VN official steps for import:duties:vn-all-official', async () => {
    await dutiesVnAllOfficial(['--url=https://seed.example/vn-mfn.xlsx', '--sheet=Sheet1']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    expect(mocks.importAseanMfnOfficialFromExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'VN',
        urlOrPath: 'https://example.com/vn.xlsx',
        sheet: 'Sheet1',
        importId: 'run-123',
      })
    );
    const [mfnCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:vn-mfn-official',
      sourceKey: 'duties.vn.official.mfn_excel',
    });
  });
});
