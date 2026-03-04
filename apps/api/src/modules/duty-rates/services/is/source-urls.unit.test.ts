import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  IS_FTA_OFFICIAL_SOURCE_KEY,
  IS_MFN_OFFICIAL_SOURCE_KEY,
  resolveIsDutySourceUrls,
} from './source-urls.js';

describe('resolveIsDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.IS_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.IS_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveIsDutySourceUrls({
      mfnUrl: 'https://override.test/is-mfn.xlsx',
      ftaUrl: 'https://override.test/is-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/is-mfn.xlsx',
      ftaUrl: 'https://override.test/is-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.IS_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/is-mfn.xlsx';
    process.env.IS_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/is-fta.xlsx';

    const urls = new Map<string, string>([
      [IS_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/is-mfn.xlsx'],
      [IS_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/is-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveIsDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/is-mfn.xlsx',
      ftaUrl: 'https://registry.test/is-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: IS_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/is-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: IS_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/is-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.IS_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/is-mfn.xlsx';
    process.env.IS_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/is-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveIsDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/is-mfn.xlsx',
      ftaUrl: 'https://env.test/is-fta.xlsx',
    });
  });
});
