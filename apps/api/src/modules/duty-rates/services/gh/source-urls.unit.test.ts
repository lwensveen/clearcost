import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  GH_FTA_OFFICIAL_SOURCE_KEY,
  GH_MFN_OFFICIAL_SOURCE_KEY,
  resolveGhDutySourceUrls,
} from './source-urls.js';

describe('resolveGhDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.GH_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.GH_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveGhDutySourceUrls({
      mfnUrl: 'https://override.test/gh-mfn.xlsx',
      ftaUrl: 'https://override.test/gh-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/gh-mfn.xlsx',
      ftaUrl: 'https://override.test/gh-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.GH_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/gh-mfn.xlsx';
    process.env.GH_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/gh-fta.xlsx';

    const urls = new Map<string, string>([
      [GH_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/gh-mfn.xlsx'],
      [GH_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/gh-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveGhDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/gh-mfn.xlsx',
      ftaUrl: 'https://registry.test/gh-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: GH_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/gh-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: GH_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/gh-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.GH_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/gh-mfn.xlsx';
    process.env.GH_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/gh-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveGhDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/gh-mfn.xlsx',
      ftaUrl: 'https://env.test/gh-fta.xlsx',
    });
  });
});
