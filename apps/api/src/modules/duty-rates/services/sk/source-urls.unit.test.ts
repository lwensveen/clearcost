import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  SK_FTA_OFFICIAL_SOURCE_KEY,
  SK_MFN_OFFICIAL_SOURCE_KEY,
  resolveSkDutySourceUrls,
} from './source-urls.js';

describe('resolveSkDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.SK_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.SK_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveSkDutySourceUrls({
      mfnUrl: 'https://override.test/sk-mfn.xlsx',
      ftaUrl: 'https://override.test/sk-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/sk-mfn.xlsx',
      ftaUrl: 'https://override.test/sk-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.SK_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/sk-mfn.xlsx';
    process.env.SK_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/sk-fta.xlsx';

    const urls = new Map<string, string>([
      [SK_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/sk-mfn.xlsx'],
      [SK_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/sk-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveSkDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/sk-mfn.xlsx',
      ftaUrl: 'https://registry.test/sk-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: SK_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/sk-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: SK_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/sk-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.SK_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/sk-mfn.xlsx';
    process.env.SK_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/sk-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveSkDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/sk-mfn.xlsx',
      ftaUrl: 'https://env.test/sk-fta.xlsx',
    });
  });
});
