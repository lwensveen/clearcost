import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import { resolveEuTaricHsSourceUrls } from './source-urls.js';

const ORIGINAL_GOODS_URL = process.env.EU_TARIC_GOODS_URL;
const ORIGINAL_DESC_URL = process.env.EU_TARIC_GOODS_DESC_URL;

describe('resolveEuTaricHsSourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.EU_TARIC_GOODS_URL = '';
    process.env.EU_TARIC_GOODS_DESC_URL = '';
    mocks.resolveSourceDownloadUrlMock.mockResolvedValue('');
  });

  afterEach(() => {
    process.env.EU_TARIC_GOODS_URL = ORIGINAL_GOODS_URL;
    process.env.EU_TARIC_GOODS_DESC_URL = ORIGINAL_DESC_URL;
  });

  it('uses explicit overrides without querying source registry', async () => {
    const out = await resolveEuTaricHsSourceUrls({
      goodsUrl: 'https://example.test/goods.xml',
      descUrl: 'https://example.test/goods-desc.xml',
    });

    expect(out).toEqual({
      goodsUrl: 'https://example.test/goods.xml',
      descUrl: 'https://example.test/goods-desc.xml',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves goods/description URLs from source registry keys with env fallbacks', async () => {
    process.env.EU_TARIC_GOODS_URL = 'https://env.example/goods.xml';
    process.env.EU_TARIC_GOODS_DESC_URL = 'https://env.example/goods-desc.xml';
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ fallbackUrl }: { fallbackUrl?: string }) => fallbackUrl ?? ''
    );

    const out = await resolveEuTaricHsSourceUrls();

    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: 'hs.eu.taric.goods',
      fallbackUrl: 'https://env.example/goods.xml',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: 'hs.eu.taric.goods_description',
      fallbackUrl: 'https://env.example/goods-desc.xml',
    });
    expect(out).toEqual({
      goodsUrl: 'https://env.example/goods.xml',
      descUrl: 'https://env.example/goods-desc.xml',
    });
  });

  it('returns empty URLs when source registry resolution fails and no fallback is configured', async () => {
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('source not configured'));

    const out = await resolveEuTaricHsSourceUrls();

    expect(out).toEqual({ goodsUrl: '', descUrl: '' });
  });
});
