import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  SA_FTA_OFFICIAL_SOURCE_KEY,
  SA_MFN_OFFICIAL_SOURCE_KEY,
  resolveSaDutySourceUrls,
} from './source-urls.js';

describe('resolveSaDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.SA_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.SA_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveSaDutySourceUrls({
      mfnUrl: 'https://override.test/sa-mfn.xlsx',
      ftaUrl: 'https://override.test/sa-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/sa-mfn.xlsx',
      ftaUrl: 'https://override.test/sa-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.SA_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/sa-mfn.xlsx';
    process.env.SA_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/sa-fta.xlsx';

    const urls = new Map<string, string>([
      [SA_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/sa-mfn.xlsx'],
      [SA_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/sa-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveSaDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/sa-mfn.xlsx',
      ftaUrl: 'https://registry.test/sa-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: SA_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/sa-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: SA_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/sa-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.SA_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/sa-mfn.xlsx';
    process.env.SA_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/sa-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveSaDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/sa-mfn.xlsx',
      ftaUrl: 'https://env.test/sa-fta.xlsx',
    });
  });
});
