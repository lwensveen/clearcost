import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  LV_FTA_OFFICIAL_SOURCE_KEY,
  LV_MFN_OFFICIAL_SOURCE_KEY,
  resolveLvDutySourceUrls,
} from './source-urls.js';

describe('resolveLvDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.LV_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.LV_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveLvDutySourceUrls({
      mfnUrl: 'https://override.test/lv-mfn.xlsx',
      ftaUrl: 'https://override.test/lv-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/lv-mfn.xlsx',
      ftaUrl: 'https://override.test/lv-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.LV_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/lv-mfn.xlsx';
    process.env.LV_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/lv-fta.xlsx';

    const urls = new Map<string, string>([
      [LV_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/lv-mfn.xlsx'],
      [LV_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/lv-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveLvDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/lv-mfn.xlsx',
      ftaUrl: 'https://registry.test/lv-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: LV_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/lv-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: LV_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/lv-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.LV_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/lv-mfn.xlsx';
    process.env.LV_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/lv-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveLvDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/lv-mfn.xlsx',
      ftaUrl: 'https://env.test/lv-fta.xlsx',
    });
  });
});
