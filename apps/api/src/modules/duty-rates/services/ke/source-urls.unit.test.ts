import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  KE_FTA_OFFICIAL_SOURCE_KEY,
  KE_MFN_OFFICIAL_SOURCE_KEY,
  resolveKeDutySourceUrls,
} from './source-urls.js';

describe('resolveKeDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.KE_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.KE_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveKeDutySourceUrls({
      mfnUrl: 'https://override.test/ke-mfn.xlsx',
      ftaUrl: 'https://override.test/ke-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/ke-mfn.xlsx',
      ftaUrl: 'https://override.test/ke-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.KE_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ke-mfn.xlsx';
    process.env.KE_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ke-fta.xlsx';

    const urls = new Map<string, string>([
      [KE_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/ke-mfn.xlsx'],
      [KE_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/ke-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveKeDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/ke-mfn.xlsx',
      ftaUrl: 'https://registry.test/ke-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: KE_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ke-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: KE_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ke-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.KE_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ke-mfn.xlsx';
    process.env.KE_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ke-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveKeDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/ke-mfn.xlsx',
      ftaUrl: 'https://env.test/ke-fta.xlsx',
    });
  });
});
