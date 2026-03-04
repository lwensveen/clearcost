import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  TW_FTA_OFFICIAL_SOURCE_KEY,
  TW_MFN_OFFICIAL_SOURCE_KEY,
  resolveTwDutySourceUrls,
} from './source-urls.js';

describe('resolveTwDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.TW_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.TW_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveTwDutySourceUrls({
      mfnUrl: 'https://override.test/tw-mfn.xlsx',
      ftaUrl: 'https://override.test/tw-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/tw-mfn.xlsx',
      ftaUrl: 'https://override.test/tw-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.TW_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/tw-mfn.xlsx';
    process.env.TW_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/tw-fta.xlsx';

    const urls = new Map<string, string>([
      [TW_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/tw-mfn.xlsx'],
      [TW_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/tw-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveTwDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/tw-mfn.xlsx',
      ftaUrl: 'https://registry.test/tw-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: TW_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/tw-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: TW_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/tw-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.TW_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/tw-mfn.xlsx';
    process.env.TW_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/tw-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveTwDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/tw-mfn.xlsx',
      ftaUrl: 'https://env.test/tw-fta.xlsx',
    });
  });
});
