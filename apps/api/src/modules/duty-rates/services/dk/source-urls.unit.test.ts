import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  DK_FTA_OFFICIAL_SOURCE_KEY,
  DK_MFN_OFFICIAL_SOURCE_KEY,
  resolveDkDutySourceUrls,
} from './source-urls.js';

describe('resolveDkDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.DK_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.DK_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveDkDutySourceUrls({
      mfnUrl: 'https://override.test/dk-mfn.xlsx',
      ftaUrl: 'https://override.test/dk-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/dk-mfn.xlsx',
      ftaUrl: 'https://override.test/dk-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.DK_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/dk-mfn.xlsx';
    process.env.DK_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/dk-fta.xlsx';

    const urls = new Map<string, string>([
      [DK_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/dk-mfn.xlsx'],
      [DK_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/dk-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveDkDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/dk-mfn.xlsx',
      ftaUrl: 'https://registry.test/dk-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: DK_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/dk-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: DK_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/dk-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.DK_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/dk-mfn.xlsx';
    process.env.DK_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/dk-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveDkDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/dk-mfn.xlsx',
      ftaUrl: 'https://env.test/dk-fta.xlsx',
    });
  });
});
