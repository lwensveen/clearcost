import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveAiDutySourceUrlsMock: vi.fn(),
  importAiMfnOfficialMock: vi.fn(),
  importFtaExcelMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/ai/source-urls.js', () => ({
  AI_MFN_OFFICIAL_SOURCE_KEY: 'duties.ai.official.mfn_excel',
  AI_FTA_OFFICIAL_SOURCE_KEY: 'duties.ai.official.fta_excel',
  resolveAiDutySourceUrls: mocks.resolveAiDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/services/ai/import-mfn-official.js', () => ({
  importAiMfnOfficial: mocks.importAiMfnOfficialMock,
}));

vi.mock(
  '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js',
  () => ({
    importAseanPreferentialOfficialFromExcel: mocks.importFtaExcelMock,
  })
);

import { dutiesAiAllOfficial, dutiesAiMfnOfficial } from './duties-ai.js';

describe('duties-ai commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveAiDutySourceUrlsMock.mockResolvedValue({
      mfnUrl: 'https://official.test/ai-mfn.xlsx',
      ftaUrl: 'https://official.test/ai-fta.xlsx',
    });
    mocks.importAiMfnOfficialMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
      scanned: 2,
      kept: 2,
      skipped: 0,
      sourceFile: 'ai-tariff.xlsx',
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

  it('runs AI MFN official import with source metadata', async () => {
    await dutiesAiMfnOfficial([
      '--url=https://override.test/ai-mfn.xlsx',
      '--sheet=Tariff',
      '--dryRun=1',
    ]);

    expect(mocks.resolveAiDutySourceUrlsMock).toHaveBeenCalledWith({
      mfnUrl: 'https://override.test/ai-mfn.xlsx',
    });
    expect(mocks.importAiMfnOfficialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://official.test/ai-mfn.xlsx',
        sheet: 'Tariff',
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'OFFICIAL',
      job: 'duties:ai-mfn-official',
      sourceKey: 'duties.ai.official.mfn_excel',
      sourceUrl: 'https://official.test/ai-mfn.xlsx',
    });
  });

  it('runs both AI official steps for import:duties:ai-all-official', async () => {
    await dutiesAiAllOfficial(['--agreement=fta', '--partner=AI']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:ai-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:ai-fta-official' });
    expect(mocks.importFtaExcelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'AI',
        agreement: 'fta',
        partner: 'AI',
        importId: 'run-123',
      })
    );
  });
});
