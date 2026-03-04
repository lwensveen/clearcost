import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  BG_FTA_OFFICIAL_SOURCE_KEY,
  BG_MFN_OFFICIAL_SOURCE_KEY,
  resolveBgDutySourceUrls,
} from './source-urls.js';

describe('resolveBgDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.BG_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.BG_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveBgDutySourceUrls({
      mfnUrl: 'https://override.test/bg-mfn.xlsx',
      ftaUrl: 'https://override.test/bg-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/bg-mfn.xlsx',
      ftaUrl: 'https://override.test/bg-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.BG_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/bg-mfn.xlsx';
    process.env.BG_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/bg-fta.xlsx';

    const urls = new Map<string, string>([
      [BG_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/bg-mfn.xlsx'],
      [BG_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/bg-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveBgDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/bg-mfn.xlsx',
      ftaUrl: 'https://registry.test/bg-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: BG_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/bg-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: BG_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/bg-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.BG_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/bg-mfn.xlsx';
    process.env.BG_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/bg-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveBgDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/bg-mfn.xlsx',
      ftaUrl: 'https://env.test/bg-fta.xlsx',
    });
  });
});
