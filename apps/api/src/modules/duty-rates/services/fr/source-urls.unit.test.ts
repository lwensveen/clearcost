import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  FR_FTA_OFFICIAL_SOURCE_KEY,
  FR_MFN_OFFICIAL_SOURCE_KEY,
  resolveFrDutySourceUrls,
} from './source-urls.js';

describe('resolveFrDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.FR_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.FR_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveFrDutySourceUrls({
      mfnUrl: 'https://override.test/fr-mfn.xlsx',
      ftaUrl: 'https://override.test/fr-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/fr-mfn.xlsx',
      ftaUrl: 'https://override.test/fr-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.FR_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/fr-mfn.xlsx';
    process.env.FR_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/fr-fta.xlsx';

    const urls = new Map<string, string>([
      [FR_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/fr-mfn.xlsx'],
      [FR_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/fr-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveFrDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/fr-mfn.xlsx',
      ftaUrl: 'https://registry.test/fr-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: FR_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/fr-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: FR_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/fr-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.FR_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/fr-mfn.xlsx';
    process.env.FR_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/fr-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveFrDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/fr-mfn.xlsx',
      ftaUrl: 'https://env.test/fr-fta.xlsx',
    });
  });
});
