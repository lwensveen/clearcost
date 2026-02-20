import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import { DEFAULT_US_SURCHARGE_SOURCE_URLS, resolveUsSurchargeSourceUrls } from './source-urls.js';

describe('resolveUsSurchargeSourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('resolves all US surcharge sources from source registry', async () => {
    mocks.resolveSourceDownloadUrlMock
      .mockResolvedValueOnce('https://registry.test/aphis-fees')
      .mockResolvedValueOnce('https://registry.test/aphis-fy')
      .mockResolvedValueOnce('https://registry.test/fda-vqip')
      .mockResolvedValueOnce('https://registry.test/fr-search')
      .mockResolvedValueOnce('https://registry.test/fr-docs');

    const out = await resolveUsSurchargeSourceUrls();

    expect(out).toEqual({
      aphisFeesUrl: 'https://registry.test/aphis-fees',
      aphisFy25Url: 'https://registry.test/aphis-fy',
      fdaVqipUrl: 'https://registry.test/fda-vqip',
      federalRegisterSearchBaseUrl: 'https://registry.test/fr-search',
      federalRegisterDocumentsApiUrl: 'https://registry.test/fr-docs',
    });
  });

  it('falls back to defaults when source registry lookup fails', async () => {
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('boom'));

    const out = await resolveUsSurchargeSourceUrls();

    expect(out).toEqual({
      aphisFeesUrl: DEFAULT_US_SURCHARGE_SOURCE_URLS.aphisFees,
      aphisFy25Url: DEFAULT_US_SURCHARGE_SOURCE_URLS.aphisFy25,
      fdaVqipUrl: DEFAULT_US_SURCHARGE_SOURCE_URLS.fdaVqip,
      federalRegisterSearchBaseUrl: DEFAULT_US_SURCHARGE_SOURCE_URLS.federalRegisterSearchBase,
      federalRegisterDocumentsApiUrl: DEFAULT_US_SURCHARGE_SOURCE_URLS.federalRegisterDocumentsApi,
    });
  });
});
