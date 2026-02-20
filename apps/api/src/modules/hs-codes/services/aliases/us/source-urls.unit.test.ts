import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import { resolveUsitcHsSourceUrls } from './source-urls.js';

describe('resolveUsitcHsSourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.HTS_API_BASE = '';
    process.env.HTS_CSV_URL = '';
    process.env.HTS_JSON_URL = '';
    mocks.resolveSourceDownloadUrlMock.mockResolvedValue('');
  });

  it('uses explicit overrides without querying source registry', async () => {
    const out = await resolveUsitcHsSourceUrls({
      baseUrl: 'https://override.test/base',
      csvUrl: 'https://override.test/csv',
      jsonUrl: 'https://override.test/json',
    });

    expect(out).toEqual({
      baseUrl: 'https://override.test/base',
      csvUrl: 'https://override.test/csv',
      jsonUrl: 'https://override.test/json',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves base/csv/json URLs from source registry keys with env fallbacks', async () => {
    process.env.HTS_API_BASE = 'https://env.test/base';
    process.env.HTS_CSV_URL = 'https://env.test/csv';
    process.env.HTS_JSON_URL = 'https://env.test/json';

    const urls = new Map<string, string>([
      ['hs.us.usitc.base', 'https://registry.test/base'],
      ['hs.us.usitc.csv', 'https://registry.test/csv'],
      ['hs.us.usitc.json', 'https://registry.test/json'],
    ]);

    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveUsitcHsSourceUrls();

    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: 'hs.us.usitc.base',
      fallbackUrl: 'https://env.test/base',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: 'hs.us.usitc.csv',
      fallbackUrl: 'https://env.test/csv',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: 'hs.us.usitc.json',
      fallbackUrl: 'https://env.test/json',
    });
    expect(out).toEqual({
      baseUrl: 'https://registry.test/base',
      csvUrl: 'https://registry.test/csv',
      jsonUrl: 'https://registry.test/json',
    });
  });

  it('falls back to env optional URLs when source registry resolution fails', async () => {
    process.env.HTS_API_BASE = 'https://env.test/base';
    process.env.HTS_CSV_URL = 'https://env.test/csv';
    process.env.HTS_JSON_URL = 'https://env.test/json';

    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => {
        if (sourceKey === 'hs.us.usitc.base') return 'https://registry.test/base';
        throw new Error('source not configured');
      }
    );

    const out = await resolveUsitcHsSourceUrls();

    expect(out).toEqual({
      baseUrl: 'https://registry.test/base',
      csvUrl: 'https://env.test/csv',
      jsonUrl: 'https://env.test/json',
    });
  });
});
