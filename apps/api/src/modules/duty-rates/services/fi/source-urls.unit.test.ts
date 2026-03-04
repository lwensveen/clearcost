import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  FI_FTA_OFFICIAL_SOURCE_KEY,
  FI_MFN_OFFICIAL_SOURCE_KEY,
  resolveFiDutySourceUrls,
} from './source-urls.js';

describe('resolveFiDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.FI_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.FI_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveFiDutySourceUrls({
      mfnUrl: 'https://override.test/fi-mfn.xlsx',
      ftaUrl: 'https://override.test/fi-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/fi-mfn.xlsx',
      ftaUrl: 'https://override.test/fi-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.FI_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/fi-mfn.xlsx';
    process.env.FI_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/fi-fta.xlsx';

    const urls = new Map<string, string>([
      [FI_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/fi-mfn.xlsx'],
      [FI_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/fi-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveFiDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/fi-mfn.xlsx',
      ftaUrl: 'https://registry.test/fi-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: FI_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/fi-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: FI_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/fi-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.FI_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/fi-mfn.xlsx';
    process.env.FI_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/fi-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveFiDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/fi-mfn.xlsx',
      ftaUrl: 'https://env.test/fi-fta.xlsx',
    });
  });
});
