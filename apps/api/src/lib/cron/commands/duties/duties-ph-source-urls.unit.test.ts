import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import { DUTIES_PH_MFN_SOURCE_KEY, resolvePhMfnExcelUrl } from './duties-ph-source-urls.js';

describe('resolvePhMfnExcelUrl', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns explicit override URL and skips source registry', async () => {
    const out = await resolvePhMfnExcelUrl({ overrideUrl: 'https://example.test/ph.xlsx' });

    expect(out).toEqual({
      sourceKey: DUTIES_PH_MFN_SOURCE_KEY,
      sourceUrl: 'https://example.test/ph.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves URL from source registry with env fallback', async () => {
    mocks.resolveSourceDownloadUrlMock.mockResolvedValue('https://registry.test/ph.xlsx');

    const out = await resolvePhMfnExcelUrl({
      env: { PH_TARIFF_EXCEL_URL: 'https://env.test/ph.xlsx' } as NodeJS.ProcessEnv,
    });

    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: DUTIES_PH_MFN_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ph.xlsx',
    });
    expect(out).toEqual({
      sourceKey: DUTIES_PH_MFN_SOURCE_KEY,
      sourceUrl: 'https://registry.test/ph.xlsx',
    });
  });

  it('falls back to env URL when source registry lookup fails', async () => {
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('source not configured'));

    const out = await resolvePhMfnExcelUrl({
      env: { PH_TARIFF_EXCEL_URL: 'https://env.test/ph.xlsx' } as NodeJS.ProcessEnv,
    });

    expect(out).toEqual({
      sourceKey: DUTIES_PH_MFN_SOURCE_KEY,
      sourceUrl: 'https://env.test/ph.xlsx',
    });
  });

  it('returns undefined sourceUrl when no override/env/registry URL exists', async () => {
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('source not configured'));

    const out = await resolvePhMfnExcelUrl({ env: {} as NodeJS.ProcessEnv });

    expect(out).toEqual({
      sourceKey: DUTIES_PH_MFN_SOURCE_KEY,
      sourceUrl: undefined,
    });
  });
});
