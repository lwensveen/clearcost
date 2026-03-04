import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  MT_FTA_OFFICIAL_SOURCE_KEY,
  MT_MFN_OFFICIAL_SOURCE_KEY,
  resolveMtDutySourceUrls,
} from './source-urls.js';

describe('resolveMtDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.MT_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.MT_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveMtDutySourceUrls({
      mfnUrl: 'https://override.test/mt-mfn.xlsx',
      ftaUrl: 'https://override.test/mt-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/mt-mfn.xlsx',
      ftaUrl: 'https://override.test/mt-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.MT_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/mt-mfn.xlsx';
    process.env.MT_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/mt-fta.xlsx';

    const urls = new Map<string, string>([
      [MT_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/mt-mfn.xlsx'],
      [MT_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/mt-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveMtDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/mt-mfn.xlsx',
      ftaUrl: 'https://registry.test/mt-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: MT_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/mt-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: MT_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/mt-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.MT_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/mt-mfn.xlsx';
    process.env.MT_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/mt-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveMtDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/mt-mfn.xlsx',
      ftaUrl: 'https://env.test/mt-fta.xlsx',
    });
  });
});
