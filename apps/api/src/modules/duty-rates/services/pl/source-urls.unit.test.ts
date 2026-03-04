import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  PL_FTA_OFFICIAL_SOURCE_KEY,
  PL_MFN_OFFICIAL_SOURCE_KEY,
  resolvePlDutySourceUrls,
} from './source-urls.js';

describe('resolvePlDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.PL_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.PL_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolvePlDutySourceUrls({
      mfnUrl: 'https://override.test/pl-mfn.xlsx',
      ftaUrl: 'https://override.test/pl-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/pl-mfn.xlsx',
      ftaUrl: 'https://override.test/pl-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.PL_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/pl-mfn.xlsx';
    process.env.PL_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/pl-fta.xlsx';

    const urls = new Map<string, string>([
      [PL_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/pl-mfn.xlsx'],
      [PL_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/pl-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolvePlDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/pl-mfn.xlsx',
      ftaUrl: 'https://registry.test/pl-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: PL_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/pl-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: PL_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/pl-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.PL_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/pl-mfn.xlsx';
    process.env.PL_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/pl-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolvePlDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/pl-mfn.xlsx',
      ftaUrl: 'https://env.test/pl-fta.xlsx',
    });
  });
});
