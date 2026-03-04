import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  CH_FTA_OFFICIAL_SOURCE_KEY,
  CH_MFN_OFFICIAL_SOURCE_KEY,
  resolveChDutySourceUrls,
} from './source-urls.js';

describe('resolveChDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.CH_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.CH_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveChDutySourceUrls({
      mfnUrl: 'https://override.test/ch-mfn.xlsx',
      ftaUrl: 'https://override.test/ch-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/ch-mfn.xlsx',
      ftaUrl: 'https://override.test/ch-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.CH_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ch-mfn.xlsx';
    process.env.CH_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ch-fta.xlsx';

    const urls = new Map<string, string>([
      [CH_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/ch-mfn.xlsx'],
      [CH_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/ch-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveChDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/ch-mfn.xlsx',
      ftaUrl: 'https://registry.test/ch-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: CH_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ch-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: CH_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ch-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.CH_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ch-mfn.xlsx';
    process.env.CH_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ch-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveChDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/ch-mfn.xlsx',
      ftaUrl: 'https://env.test/ch-fta.xlsx',
    });
  });
});
