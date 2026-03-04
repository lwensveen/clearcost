import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  BE_FTA_OFFICIAL_SOURCE_KEY,
  BE_MFN_OFFICIAL_SOURCE_KEY,
  resolveBeDutySourceUrls,
} from './source-urls.js';

describe('resolveBeDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.BE_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.BE_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveBeDutySourceUrls({
      mfnUrl: 'https://override.test/be-mfn.xlsx',
      ftaUrl: 'https://override.test/be-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/be-mfn.xlsx',
      ftaUrl: 'https://override.test/be-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.BE_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/be-mfn.xlsx';
    process.env.BE_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/be-fta.xlsx';

    const urls = new Map<string, string>([
      [BE_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/be-mfn.xlsx'],
      [BE_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/be-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveBeDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/be-mfn.xlsx',
      ftaUrl: 'https://registry.test/be-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: BE_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/be-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: BE_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/be-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.BE_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/be-mfn.xlsx';
    process.env.BE_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/be-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveBeDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/be-mfn.xlsx',
      ftaUrl: 'https://env.test/be-fta.xlsx',
    });
  });
});
