import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  CA_FTA_OFFICIAL_SOURCE_KEY,
  CA_MFN_OFFICIAL_SOURCE_KEY,
  resolveCaDutySourceUrls,
} from './source-urls.js';

describe('resolveCaDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.CA_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.CA_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveCaDutySourceUrls({
      mfnUrl: 'https://override.test/ca-mfn.xlsx',
      ftaUrl: 'https://override.test/ca-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/ca-mfn.xlsx',
      ftaUrl: 'https://override.test/ca-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.CA_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ca-mfn.xlsx';
    process.env.CA_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ca-fta.xlsx';

    const urls = new Map<string, string>([
      [CA_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/ca-mfn.xlsx'],
      [CA_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/ca-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveCaDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/ca-mfn.xlsx',
      ftaUrl: 'https://registry.test/ca-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: CA_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ca-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: CA_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ca-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.CA_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ca-mfn.xlsx';
    process.env.CA_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ca-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveCaDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/ca-mfn.xlsx',
      ftaUrl: 'https://env.test/ca-fta.xlsx',
    });
  });
});
