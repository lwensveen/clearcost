import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  AU_FTA_OFFICIAL_SOURCE_KEY,
  AU_MFN_OFFICIAL_SOURCE_KEY,
  resolveAuDutySourceUrls,
} from './source-urls.js';

describe('resolveAuDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.AU_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.AU_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveAuDutySourceUrls({
      mfnUrl: 'https://override.test/au-mfn.xlsx',
      ftaUrl: 'https://override.test/au-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/au-mfn.xlsx',
      ftaUrl: 'https://override.test/au-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.AU_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/au-mfn.xlsx';
    process.env.AU_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/au-fta.xlsx';

    const urls = new Map<string, string>([
      [AU_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/au-mfn.xlsx'],
      [AU_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/au-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveAuDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/au-mfn.xlsx',
      ftaUrl: 'https://registry.test/au-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AU_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/au-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AU_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/au-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.AU_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/au-mfn.xlsx';
    process.env.AU_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/au-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveAuDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/au-mfn.xlsx',
      ftaUrl: 'https://env.test/au-fta.xlsx',
    });
  });
});
