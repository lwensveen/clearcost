import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  AT_FTA_OFFICIAL_SOURCE_KEY,
  AT_MFN_OFFICIAL_SOURCE_KEY,
  resolveAtDutySourceUrls,
} from './source-urls.js';

describe('resolveAtDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.AT_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.AT_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveAtDutySourceUrls({
      mfnUrl: 'https://override.test/at-mfn.xlsx',
      ftaUrl: 'https://override.test/at-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/at-mfn.xlsx',
      ftaUrl: 'https://override.test/at-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.AT_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/at-mfn.xlsx';
    process.env.AT_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/at-fta.xlsx';

    const urls = new Map<string, string>([
      [AT_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/at-mfn.xlsx'],
      [AT_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/at-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveAtDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/at-mfn.xlsx',
      ftaUrl: 'https://registry.test/at-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AT_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/at-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AT_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/at-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.AT_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/at-mfn.xlsx';
    process.env.AT_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/at-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveAtDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/at-mfn.xlsx',
      ftaUrl: 'https://env.test/at-fta.xlsx',
    });
  });
});
