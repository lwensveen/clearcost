import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  IT_FTA_OFFICIAL_SOURCE_KEY,
  IT_MFN_OFFICIAL_SOURCE_KEY,
  resolveItDutySourceUrls,
} from './source-urls.js';

describe('resolveItDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.IT_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.IT_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveItDutySourceUrls({
      mfnUrl: 'https://override.test/it-mfn.xlsx',
      ftaUrl: 'https://override.test/it-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/it-mfn.xlsx',
      ftaUrl: 'https://override.test/it-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.IT_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/it-mfn.xlsx';
    process.env.IT_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/it-fta.xlsx';

    const urls = new Map<string, string>([
      [IT_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/it-mfn.xlsx'],
      [IT_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/it-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveItDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/it-mfn.xlsx',
      ftaUrl: 'https://registry.test/it-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: IT_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/it-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: IT_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/it-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.IT_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/it-mfn.xlsx';
    process.env.IT_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/it-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveItDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/it-mfn.xlsx',
      ftaUrl: 'https://env.test/it-fta.xlsx',
    });
  });
});
