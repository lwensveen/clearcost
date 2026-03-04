import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  AO_FTA_OFFICIAL_SOURCE_KEY,
  AO_MFN_OFFICIAL_SOURCE_KEY,
  resolveAoDutySourceUrls,
} from './source-urls.js';

describe('resolveAoDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.AO_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.AO_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveAoDutySourceUrls({
      mfnUrl: 'https://override.test/ao-mfn.xlsx',
      ftaUrl: 'https://override.test/ao-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/ao-mfn.xlsx',
      ftaUrl: 'https://override.test/ao-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.AO_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ao-mfn.xlsx';
    process.env.AO_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ao-fta.xlsx';

    const urls = new Map<string, string>([
      [AO_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/ao-mfn.xlsx'],
      [AO_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/ao-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveAoDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/ao-mfn.xlsx',
      ftaUrl: 'https://registry.test/ao-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AO_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ao-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AO_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ao-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.AO_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ao-mfn.xlsx';
    process.env.AO_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ao-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveAoDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/ao-mfn.xlsx',
      ftaUrl: 'https://env.test/ao-fta.xlsx',
    });
  });
});
