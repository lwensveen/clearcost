import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  SE_FTA_OFFICIAL_SOURCE_KEY,
  SE_MFN_OFFICIAL_SOURCE_KEY,
  resolveSeDutySourceUrls,
} from './source-urls.js';

describe('resolveSeDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.SE_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.SE_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveSeDutySourceUrls({
      mfnUrl: 'https://override.test/se-mfn.xlsx',
      ftaUrl: 'https://override.test/se-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/se-mfn.xlsx',
      ftaUrl: 'https://override.test/se-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.SE_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/se-mfn.xlsx';
    process.env.SE_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/se-fta.xlsx';

    const urls = new Map<string, string>([
      [SE_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/se-mfn.xlsx'],
      [SE_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/se-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveSeDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/se-mfn.xlsx',
      ftaUrl: 'https://registry.test/se-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: SE_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/se-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: SE_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/se-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.SE_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/se-mfn.xlsx';
    process.env.SE_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/se-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveSeDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/se-mfn.xlsx',
      ftaUrl: 'https://env.test/se-fta.xlsx',
    });
  });
});
