import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  SI_FTA_OFFICIAL_SOURCE_KEY,
  SI_MFN_OFFICIAL_SOURCE_KEY,
  resolveSiDutySourceUrls,
} from './source-urls.js';

describe('resolveSiDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.SI_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.SI_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveSiDutySourceUrls({
      mfnUrl: 'https://override.test/si-mfn.xlsx',
      ftaUrl: 'https://override.test/si-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/si-mfn.xlsx',
      ftaUrl: 'https://override.test/si-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.SI_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/si-mfn.xlsx';
    process.env.SI_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/si-fta.xlsx';

    const urls = new Map<string, string>([
      [SI_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/si-mfn.xlsx'],
      [SI_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/si-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveSiDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/si-mfn.xlsx',
      ftaUrl: 'https://registry.test/si-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: SI_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/si-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: SI_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/si-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.SI_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/si-mfn.xlsx';
    process.env.SI_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/si-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveSiDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/si-mfn.xlsx',
      ftaUrl: 'https://env.test/si-fta.xlsx',
    });
  });
});
