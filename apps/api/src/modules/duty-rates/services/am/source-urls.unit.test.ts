import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  AM_FTA_OFFICIAL_SOURCE_KEY,
  AM_MFN_OFFICIAL_SOURCE_KEY,
  resolveAmDutySourceUrls,
} from './source-urls.js';

describe('resolveAmDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.AM_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.AM_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveAmDutySourceUrls({
      mfnUrl: 'https://override.test/am-mfn.xlsx',
      ftaUrl: 'https://override.test/am-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/am-mfn.xlsx',
      ftaUrl: 'https://override.test/am-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.AM_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/am-mfn.xlsx';
    process.env.AM_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/am-fta.xlsx';

    const urls = new Map<string, string>([
      [AM_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/am-mfn.xlsx'],
      [AM_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/am-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveAmDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/am-mfn.xlsx',
      ftaUrl: 'https://registry.test/am-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AM_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/am-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AM_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/am-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.AM_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/am-mfn.xlsx';
    process.env.AM_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/am-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveAmDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/am-mfn.xlsx',
      ftaUrl: 'https://env.test/am-fta.xlsx',
    });
  });
});
