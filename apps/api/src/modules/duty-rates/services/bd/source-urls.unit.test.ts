import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  BD_FTA_OFFICIAL_SOURCE_KEY,
  BD_MFN_OFFICIAL_SOURCE_KEY,
  resolveBdDutySourceUrls,
} from './source-urls.js';

describe('resolveBdDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.BD_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.BD_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveBdDutySourceUrls({
      mfnUrl: 'https://override.test/bd-mfn.xlsx',
      ftaUrl: 'https://override.test/bd-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/bd-mfn.xlsx',
      ftaUrl: 'https://override.test/bd-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.BD_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/bd-mfn.xlsx';
    process.env.BD_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/bd-fta.xlsx';

    const urls = new Map<string, string>([
      [BD_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/bd-mfn.xlsx'],
      [BD_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/bd-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveBdDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/bd-mfn.xlsx',
      ftaUrl: 'https://registry.test/bd-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: BD_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/bd-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: BD_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/bd-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.BD_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/bd-mfn.xlsx';
    process.env.BD_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/bd-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveBdDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/bd-mfn.xlsx',
      ftaUrl: 'https://env.test/bd-fta.xlsx',
    });
  });
});
