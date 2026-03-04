import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  ZA_FTA_OFFICIAL_SOURCE_KEY,
  ZA_MFN_OFFICIAL_SOURCE_KEY,
  resolveZaDutySourceUrls,
} from './source-urls.js';

describe('resolveZaDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.ZA_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.ZA_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveZaDutySourceUrls({
      mfnUrl: 'https://override.test/za-mfn.xlsx',
      ftaUrl: 'https://override.test/za-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/za-mfn.xlsx',
      ftaUrl: 'https://override.test/za-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.ZA_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/za-mfn.xlsx';
    process.env.ZA_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/za-fta.xlsx';

    const urls = new Map<string, string>([
      [ZA_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/za-mfn.xlsx'],
      [ZA_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/za-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveZaDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/za-mfn.xlsx',
      ftaUrl: 'https://registry.test/za-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: ZA_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/za-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: ZA_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/za-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.ZA_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/za-mfn.xlsx';
    process.env.ZA_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/za-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveZaDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/za-mfn.xlsx',
      ftaUrl: 'https://env.test/za-fta.xlsx',
    });
  });
});
