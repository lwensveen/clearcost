import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveAseanDutySourceUrlMock: vi.fn(),
  importMyMfnFromExcelMock: vi.fn(),
  importMyPreferentialFromExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/asean/source-urls.js', () => ({
  resolveAseanDutySourceUrl: mocks.resolveAseanDutySourceUrlMock,
}));

vi.mock('../../../../modules/duty-rates/services/asean/my/import-mfn-excel.js', () => ({
  importMyMfnFromExcel: mocks.importMyMfnFromExcelMock,
}));

vi.mock('../../../../modules/duty-rates/services/asean/my/import-preferential-excel.js', () => ({
  importMyPreferentialFromExcel: mocks.importMyPreferentialFromExcelMock,
}));

import { dutiesMyAllOfficial, dutiesMyMfnOfficial } from './duties-my.js';

describe('duties-my commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveAseanDutySourceUrlMock.mockResolvedValue('https://example.com/my.xlsx');
    mocks.importMyMfnFromExcelMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
    });
    mocks.importMyPreferentialFromExcelMock.mockResolvedValue({
      ok: true,
      inserted: 3,
      updated: 0,
      count: 3,
    });
  });

  it('runs MY MFN official import with official source metadata', async () => {
    await dutiesMyMfnOfficial([
      '--url=https://seed.example/my-mfn.xlsx',
      '--sheet=1',
      '--dryRun=1',
    ]);

    expect(mocks.resolveAseanDutySourceUrlMock).toHaveBeenCalledWith({
      sourceKey: 'duties.my.official.mfn_excel',
      fallbackUrl: 'https://seed.example/my-mfn.xlsx',
    });
    expect(mocks.importMyMfnFromExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/my.xlsx',
        sheet: 1,
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:my-mfn-official',
      sourceKey: 'duties.my.official.mfn_excel',
    });
  });

  it('runs both MY official steps for import:duties:my-all-official', async () => {
    await dutiesMyAllOfficial([
      '--url=https://seed.example/my-fta.xlsx',
      '--sheet=Sheet1',
      '--partner=SG',
      '--agreement=ATIGA',
    ]);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    expect(mocks.importMyMfnFromExcelMock).toHaveBeenCalledTimes(1);
    expect(mocks.importMyPreferentialFromExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/my.xlsx',
        sheet: 'Sheet1',
        partner: 'SG',
        agreement: 'ATIGA',
        importId: 'run-123',
      })
    );
    const [, ftaCall] = mocks.withRunMock.mock.calls;
    expect(ftaCall?.[0]).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:my-fta-official',
      sourceKey: 'duties.my.official.fta_excel',
    });
  });
});
