import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  HU_FTA_OFFICIAL_SOURCE_KEY,
  HU_MFN_OFFICIAL_SOURCE_KEY,
  resolveHuDutySourceUrls,
} from './source-urls.js';

describe('resolveHuDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.HU_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.HU_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveHuDutySourceUrls({
      mfnUrl: 'https://override.test/hu-mfn.xlsx',
      ftaUrl: 'https://override.test/hu-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/hu-mfn.xlsx',
      ftaUrl: 'https://override.test/hu-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.HU_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/hu-mfn.xlsx';
    process.env.HU_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/hu-fta.xlsx';

    const urls = new Map<string, string>([
      [HU_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/hu-mfn.xlsx'],
      [HU_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/hu-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveHuDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/hu-mfn.xlsx',
      ftaUrl: 'https://registry.test/hu-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: HU_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/hu-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: HU_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/hu-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.HU_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/hu-mfn.xlsx';
    process.env.HU_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/hu-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveHuDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/hu-mfn.xlsx',
      ftaUrl: 'https://env.test/hu-fta.xlsx',
    });
  });
});
