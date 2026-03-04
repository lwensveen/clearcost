import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  TR_FTA_OFFICIAL_SOURCE_KEY,
  TR_MFN_OFFICIAL_SOURCE_KEY,
  resolveTrDutySourceUrls,
} from './source-urls.js';

describe('resolveTrDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.TR_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.TR_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveTrDutySourceUrls({
      mfnUrl: 'https://override.test/tr-mfn.xlsx',
      ftaUrl: 'https://override.test/tr-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/tr-mfn.xlsx',
      ftaUrl: 'https://override.test/tr-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.TR_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/tr-mfn.xlsx';
    process.env.TR_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/tr-fta.xlsx';

    const urls = new Map<string, string>([
      [TR_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/tr-mfn.xlsx'],
      [TR_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/tr-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveTrDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/tr-mfn.xlsx',
      ftaUrl: 'https://registry.test/tr-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: TR_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/tr-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: TR_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/tr-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.TR_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/tr-mfn.xlsx';
    process.env.TR_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/tr-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveTrDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/tr-mfn.xlsx',
      ftaUrl: 'https://env.test/tr-fta.xlsx',
    });
  });
});
