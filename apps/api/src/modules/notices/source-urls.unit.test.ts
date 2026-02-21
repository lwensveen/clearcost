import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import { resolveCnNoticeSeedUrls } from './source-urls.js';

describe('resolveCnNoticeSeedUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('uses explicit URLs without querying source registry', async () => {
    const out = await resolveCnNoticeSeedUrls({
      authority: 'MOF',
      explicitUrls: ['https://example.test/a', 'https://example.test/b'],
    });

    expect(out).toEqual({
      sourceKey: 'notices.cn.mof.list',
      sourceUrl: 'https://example.test/a',
      urls: ['https://example.test/a', 'https://example.test/b'],
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry and keeps env URLs as additional seeds', async () => {
    mocks.resolveSourceDownloadUrlMock.mockResolvedValue('https://registry.test/mof/list');

    const out = await resolveCnNoticeSeedUrls({
      authority: 'MOF',
      env: {
        CN_MOF_NOTICE_URLS: 'https://env.test/mof/a,https://env.test/mof/b',
      } as NodeJS.ProcessEnv,
    });

    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: 'notices.cn.mof.list',
      fallbackUrl: 'https://env.test/mof/a',
    });
    expect(out).toEqual({
      sourceKey: 'notices.cn.mof.list',
      sourceUrl: 'https://registry.test/mof/list',
      urls: ['https://registry.test/mof/list', 'https://env.test/mof/a', 'https://env.test/mof/b'],
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('source not configured'));

    const out = await resolveCnNoticeSeedUrls({
      authority: 'GACC',
      env: {
        CN_GACC_NOTICE_URLS: 'https://env.test/gacc/list',
      } as NodeJS.ProcessEnv,
    });

    expect(out).toEqual({
      sourceKey: 'notices.cn.gacc.list',
      sourceUrl: 'https://env.test/gacc/list',
      urls: ['https://env.test/gacc/list'],
    });
  });
});
