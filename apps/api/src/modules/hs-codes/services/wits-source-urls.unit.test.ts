import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import { resolveWitsHsSourceUrls } from './wits-source-urls.js';

describe('resolveWitsHsSourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.WITS_HS_SDMX_DATA_BASE = '';
    process.env.WITS_HS_DSD_URL = '';
    process.env.WITS_HS_PRODUCTS_ALL_URL = '';
    mocks.resolveSourceDownloadUrlMock.mockResolvedValue('');
  });

  it('uses explicit overrides without querying source registry', async () => {
    const out = await resolveWitsHsSourceUrls({
      dataBaseUrl: 'https://override.test/data',
      dsdUrl: 'https://override.test/dsd',
      productsAllUrl: 'https://override.test/products',
    });

    expect(out).toEqual({
      dataBaseUrl: 'https://override.test/data',
      dsdUrl: 'https://override.test/dsd',
      productsAllUrl: 'https://override.test/products',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves WITS HS URLs from source registry keys with env fallbacks', async () => {
    process.env.WITS_HS_SDMX_DATA_BASE = 'https://env.test/data';
    process.env.WITS_HS_DSD_URL = 'https://env.test/dsd';
    process.env.WITS_HS_PRODUCTS_ALL_URL = 'https://env.test/products';

    const urls = new Map<string, string>([
      ['hs.wits.sdmx.data_base', 'https://registry.test/data'],
      ['hs.wits.sdmx.datastructure', 'https://registry.test/dsd'],
      ['hs.wits.products.all', 'https://registry.test/products'],
    ]);

    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveWitsHsSourceUrls();

    expect(out).toEqual({
      dataBaseUrl: 'https://registry.test/data',
      dsdUrl: 'https://registry.test/dsd',
      productsAllUrl: 'https://registry.test/products',
    });
  });

  it('falls back to env optional URLs when source registry resolution fails', async () => {
    process.env.WITS_HS_SDMX_DATA_BASE = 'https://env.test/data';
    process.env.WITS_HS_DSD_URL = 'https://env.test/dsd';
    process.env.WITS_HS_PRODUCTS_ALL_URL = 'https://env.test/products';

    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => {
        if (sourceKey === 'hs.wits.sdmx.data_base') return 'https://registry.test/data';
        throw new Error('source not configured');
      }
    );

    const out = await resolveWitsHsSourceUrls();

    expect(out).toEqual({
      dataBaseUrl: 'https://registry.test/data',
      dsdUrl: 'https://env.test/dsd',
      productsAllUrl: 'https://env.test/products',
    });
  });
});
