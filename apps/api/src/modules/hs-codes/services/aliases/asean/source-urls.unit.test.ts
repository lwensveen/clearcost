import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import { resolveAhtnSourceUrls } from './source-urls.js';

describe('resolveAhtnSourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.AHTN_CSV_URL = '';
    mocks.resolveSourceDownloadUrlMock.mockResolvedValue('');
  });

  it('uses explicit override without querying source registry', async () => {
    const out = await resolveAhtnSourceUrls({ csvUrl: 'https://override.test/ahtn.csv' });

    expect(out).toEqual({ csvUrl: 'https://override.test/ahtn.csv' });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves AHTN CSV URL from source registry with env fallback', async () => {
    process.env.AHTN_CSV_URL = 'https://env.test/ahtn.csv';
    mocks.resolveSourceDownloadUrlMock.mockResolvedValue('https://registry.test/ahtn.csv');

    const out = await resolveAhtnSourceUrls();

    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: 'hs.asean.ahtn.csv',
      fallbackUrl: 'https://env.test/ahtn.csv',
    });
    expect(out).toEqual({ csvUrl: 'https://registry.test/ahtn.csv' });
  });

  it('falls back to env when source registry resolution fails', async () => {
    process.env.AHTN_CSV_URL = 'https://env.test/ahtn.csv';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('source not configured'));

    const out = await resolveAhtnSourceUrls();

    expect(out).toEqual({ csvUrl: 'https://env.test/ahtn.csv' });
  });
});
