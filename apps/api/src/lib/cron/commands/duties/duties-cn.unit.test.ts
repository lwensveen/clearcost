import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  importCnMfnFromPdfMock: vi.fn(),
  resolveCnMfnPdfInputMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/cn/import-mfn-pdf.js', () => ({
  importCnMfnFromPdf: mocks.importCnMfnFromPdfMock,
}));

vi.mock('./duties-cn-source-urls.js', () => ({
  DUTIES_CN_MFN_PDF_SOURCE_KEY: 'duties.cn.taxbook.pdf',
  resolveCnMfnPdfInput: mocks.resolveCnMfnPdfInputMock,
}));

import { dutiesCnMfnPdf } from './duties-cn.js';

describe('duties-cn command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    mocks.resolveCnMfnPdfInputMock.mockResolvedValue({
      sourceKey: 'duties.cn.taxbook.pdf',
      sourceUrl: 'https://example.test/cn.pdf',
      urlOrPath: 'https://example.test/cn.pdf',
    });
    mocks.importCnMfnFromPdfMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
    });
    mocks.withRunMock.mockImplementation(async (ctx, work) => {
      const out = await work('run-123');
      return { ...ctx, ...out.payload };
    });
  });

  it('records CN official MFN job metadata', async () => {
    await dutiesCnMfnPdf(['--url=https://example.test/cn.pdf', '--dryRun=1']);

    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'CN_TAXBOOK',
      job: 'duties:cn-mfn-official',
      sourceKey: 'duties.cn.taxbook.pdf',
      sourceUrl: 'https://example.test/cn.pdf',
    });
    expect(mocks.importCnMfnFromPdfMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://example.test/cn.pdf',
        dryRun: true,
        importId: 'run-123',
      })
    );
  });
});
