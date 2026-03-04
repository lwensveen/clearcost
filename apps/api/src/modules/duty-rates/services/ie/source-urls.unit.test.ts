import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  IE_FTA_OFFICIAL_SOURCE_KEY,
  IE_MFN_OFFICIAL_SOURCE_KEY,
  resolveIeDutySourceUrls,
} from './source-urls.js';

describe('resolveIeDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.IE_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.IE_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveIeDutySourceUrls({
      mfnUrl: 'https://override.test/ie-mfn.xlsx',
      ftaUrl: 'https://override.test/ie-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/ie-mfn.xlsx',
      ftaUrl: 'https://override.test/ie-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.IE_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ie-mfn.xlsx';
    process.env.IE_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ie-fta.xlsx';

    const urls = new Map<string, string>([
      [IE_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/ie-mfn.xlsx'],
      [IE_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/ie-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveIeDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/ie-mfn.xlsx',
      ftaUrl: 'https://registry.test/ie-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: IE_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ie-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: IE_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ie-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.IE_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ie-mfn.xlsx';
    process.env.IE_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ie-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveIeDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/ie-mfn.xlsx',
      ftaUrl: 'https://env.test/ie-fta.xlsx',
    });
  });
});
