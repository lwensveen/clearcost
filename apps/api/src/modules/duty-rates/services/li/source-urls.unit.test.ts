import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  LI_FTA_OFFICIAL_SOURCE_KEY,
  LI_MFN_OFFICIAL_SOURCE_KEY,
  resolveLiDutySourceUrls,
} from './source-urls.js';

describe('resolveLiDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.LI_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.LI_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveLiDutySourceUrls({
      mfnUrl: 'https://override.test/li-mfn.xlsx',
      ftaUrl: 'https://override.test/li-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/li-mfn.xlsx',
      ftaUrl: 'https://override.test/li-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.LI_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/li-mfn.xlsx';
    process.env.LI_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/li-fta.xlsx';

    const urls = new Map<string, string>([
      [LI_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/li-mfn.xlsx'],
      [LI_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/li-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveLiDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/li-mfn.xlsx',
      ftaUrl: 'https://registry.test/li-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: LI_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/li-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: LI_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/li-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.LI_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/li-mfn.xlsx';
    process.env.LI_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/li-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveLiDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/li-mfn.xlsx',
      ftaUrl: 'https://env.test/li-fta.xlsx',
    });
  });
});
