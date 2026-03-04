import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  AE_FTA_OFFICIAL_SOURCE_KEY,
  AE_MFN_OFFICIAL_SOURCE_KEY,
  resolveAeDutySourceUrls,
} from './source-urls.js';

describe('resolveAeDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.AE_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.AE_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveAeDutySourceUrls({
      mfnUrl: 'https://override.test/ae-mfn.xlsx',
      ftaUrl: 'https://override.test/ae-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/ae-mfn.xlsx',
      ftaUrl: 'https://override.test/ae-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.AE_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ae-mfn.xlsx';
    process.env.AE_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ae-fta.xlsx';

    const urls = new Map<string, string>([
      [AE_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/ae-mfn.xlsx'],
      [AE_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/ae-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveAeDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/ae-mfn.xlsx',
      ftaUrl: 'https://registry.test/ae-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AE_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ae-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AE_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ae-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.AE_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ae-mfn.xlsx';
    process.env.AE_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ae-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveAeDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/ae-mfn.xlsx',
      ftaUrl: 'https://env.test/ae-fta.xlsx',
    });
  });
});
