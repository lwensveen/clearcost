import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  LU_FTA_OFFICIAL_SOURCE_KEY,
  LU_MFN_OFFICIAL_SOURCE_KEY,
  resolveLuDutySourceUrls,
} from './source-urls.js';

describe('resolveLuDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.LU_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.LU_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveLuDutySourceUrls({
      mfnUrl: 'https://override.test/lu-mfn.xlsx',
      ftaUrl: 'https://override.test/lu-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/lu-mfn.xlsx',
      ftaUrl: 'https://override.test/lu-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.LU_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/lu-mfn.xlsx';
    process.env.LU_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/lu-fta.xlsx';

    const urls = new Map<string, string>([
      [LU_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/lu-mfn.xlsx'],
      [LU_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/lu-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveLuDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/lu-mfn.xlsx',
      ftaUrl: 'https://registry.test/lu-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: LU_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/lu-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: LU_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/lu-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.LU_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/lu-mfn.xlsx';
    process.env.LU_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/lu-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveLuDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/lu-mfn.xlsx',
      ftaUrl: 'https://env.test/lu-fta.xlsx',
    });
  });
});
