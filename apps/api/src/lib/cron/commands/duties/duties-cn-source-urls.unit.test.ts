import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import { DUTIES_CN_MFN_PDF_SOURCE_KEY, resolveCnMfnPdfInput } from './duties-cn-source-urls.js';

describe('resolveCnMfnPdfInput', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns explicit URL override and skips source registry', async () => {
    const out = await resolveCnMfnPdfInput({ overrideUrl: 'https://example.test/cn.pdf' });

    expect(out).toEqual({
      sourceKey: DUTIES_CN_MFN_PDF_SOURCE_KEY,
      urlOrPath: 'https://example.test/cn.pdf',
      sourceUrl: 'https://example.test/cn.pdf',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('returns explicit file override and leaves sourceUrl undefined', async () => {
    const out = await resolveCnMfnPdfInput({ overrideFile: '/tmp/cn.pdf' });

    expect(out).toEqual({
      sourceKey: DUTIES_CN_MFN_PDF_SOURCE_KEY,
      urlOrPath: '/tmp/cn.pdf',
      sourceUrl: undefined,
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves source URL from source registry when no override is provided', async () => {
    mocks.resolveSourceDownloadUrlMock.mockResolvedValue('https://registry.test/cn-taxbook.pdf');

    const out = await resolveCnMfnPdfInput();

    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: DUTIES_CN_MFN_PDF_SOURCE_KEY,
    });
    expect(out).toEqual({
      sourceKey: DUTIES_CN_MFN_PDF_SOURCE_KEY,
      urlOrPath: 'https://registry.test/cn-taxbook.pdf',
      sourceUrl: 'https://registry.test/cn-taxbook.pdf',
    });
  });

  it('returns undefined urlOrPath when source registry lookup fails', async () => {
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('source not configured'));

    const out = await resolveCnMfnPdfInput();

    expect(out).toEqual({
      sourceKey: DUTIES_CN_MFN_PDF_SOURCE_KEY,
      urlOrPath: undefined,
      sourceUrl: undefined,
    });
  });
});
