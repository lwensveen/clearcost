import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  AD_FTA_OFFICIAL_SOURCE_KEY,
  AD_MFN_OFFICIAL_SOURCE_KEY,
  resolveAdDutySourceUrls,
} from './source-urls.js';

describe('resolveAdDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.AD_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.AD_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveAdDutySourceUrls({
      mfnUrl: 'https://override.test/ad-mfn.xlsx',
      ftaUrl: 'https://override.test/ad-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/ad-mfn.xlsx',
      ftaUrl: 'https://override.test/ad-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.AD_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ad-mfn.xlsx';
    process.env.AD_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ad-fta.xlsx';

    const urls = new Map<string, string>([
      [AD_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/ad-mfn.xlsx'],
      [AD_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/ad-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveAdDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/ad-mfn.xlsx',
      ftaUrl: 'https://registry.test/ad-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AD_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ad-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AD_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ad-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.AD_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ad-mfn.xlsx';
    process.env.AD_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ad-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveAdDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/ad-mfn.xlsx',
      ftaUrl: 'https://env.test/ad-fta.xlsx',
    });
  });
});
