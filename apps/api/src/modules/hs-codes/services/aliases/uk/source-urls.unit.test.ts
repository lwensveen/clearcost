import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import { resolveUkTariffHsSourceUrls } from './source-urls.js';

describe('resolveUkTariffHsSourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.UK_10_DATA_API_BASE = '';
    mocks.resolveSourceDownloadUrlMock.mockResolvedValue('');
  });

  it('uses explicit override without querying source registry', async () => {
    const out = await resolveUkTariffHsSourceUrls({ apiBaseUrl: 'https://override.test' });

    expect(out).toEqual({ apiBaseUrl: 'https://override.test' });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves UK tariff API base from source registry with env fallback', async () => {
    process.env.UK_10_DATA_API_BASE = 'https://env.test';
    mocks.resolveSourceDownloadUrlMock.mockResolvedValue('https://registry.test');

    const out = await resolveUkTariffHsSourceUrls();

    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: 'hs.uk.tariff.api_base',
      fallbackUrl: 'https://env.test',
    });
    expect(out).toEqual({ apiBaseUrl: 'https://registry.test' });
  });

  it('falls back to env when source registry resolution fails', async () => {
    process.env.UK_10_DATA_API_BASE = 'https://env.test';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('source not configured'));

    const out = await resolveUkTariffHsSourceUrls();

    expect(out).toEqual({ apiBaseUrl: 'https://env.test' });
  });
});
