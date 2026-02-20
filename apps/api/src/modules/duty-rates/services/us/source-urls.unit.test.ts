import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import { resolveUsitcDutySourceUrls } from './source-urls.js';

describe('resolveUsitcDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.HTS_API_BASE = '';
    process.env.HTS_CSV_URL = '';
    mocks.resolveSourceDownloadUrlMock.mockResolvedValue('');
  });

  it('uses explicit overrides without querying source registry', async () => {
    const out = await resolveUsitcDutySourceUrls({
      baseUrl: 'https://override.test/base',
      csvUrl: 'https://override.test/csv',
    });

    expect(out).toEqual({
      baseUrl: 'https://override.test/base',
      csvUrl: 'https://override.test/csv',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves base/csv URLs from source registry keys with env fallbacks', async () => {
    process.env.HTS_API_BASE = 'https://env.test/base';
    process.env.HTS_CSV_URL = 'https://env.test/csv';

    const urls = new Map<string, string>([
      ['duties.us.usitc.base', 'https://registry.test/base'],
      ['duties.us.usitc.csv', 'https://registry.test/csv'],
    ]);

    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveUsitcDutySourceUrls();

    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: 'duties.us.usitc.base',
      fallbackUrl: 'https://env.test/base',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: 'duties.us.usitc.csv',
      fallbackUrl: 'https://env.test/csv',
    });
    expect(out).toEqual({
      baseUrl: 'https://registry.test/base',
      csvUrl: 'https://registry.test/csv',
    });
  });

  it('falls back to env CSV URL when source registry resolution fails', async () => {
    process.env.HTS_API_BASE = 'https://env.test/base';
    process.env.HTS_CSV_URL = 'https://env.test/csv';

    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => {
        if (sourceKey === 'duties.us.usitc.base') return 'https://registry.test/base';
        throw new Error('source not configured');
      }
    );

    const out = await resolveUsitcDutySourceUrls();

    expect(out).toEqual({
      baseUrl: 'https://registry.test/base',
      csvUrl: 'https://env.test/csv',
    });
  });
});
