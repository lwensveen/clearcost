import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  AR_FTA_OFFICIAL_SOURCE_KEY,
  AR_MFN_OFFICIAL_SOURCE_KEY,
  resolveArDutySourceUrls,
} from './source-urls.js';

describe('resolveArDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.AR_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.AR_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveArDutySourceUrls({
      mfnUrl: 'https://override.test/ar-mfn.xlsx',
      ftaUrl: 'https://override.test/ar-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/ar-mfn.xlsx',
      ftaUrl: 'https://override.test/ar-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.AR_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ar-mfn.xlsx';
    process.env.AR_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ar-fta.xlsx';

    const urls = new Map<string, string>([
      [AR_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/ar-mfn.xlsx'],
      [AR_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/ar-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveArDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/ar-mfn.xlsx',
      ftaUrl: 'https://registry.test/ar-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AR_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ar-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AR_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ar-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.AR_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ar-mfn.xlsx';
    process.env.AR_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ar-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveArDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/ar-mfn.xlsx',
      ftaUrl: 'https://env.test/ar-fta.xlsx',
    });
  });
});
