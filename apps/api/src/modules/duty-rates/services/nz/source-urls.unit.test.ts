import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  NZ_FTA_OFFICIAL_SOURCE_KEY,
  NZ_MFN_OFFICIAL_SOURCE_KEY,
  resolveNzDutySourceUrls,
} from './source-urls.js';

describe('resolveNzDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.NZ_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.NZ_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveNzDutySourceUrls({
      mfnUrl: 'https://override.test/nz-mfn.tar.gz',
      ftaUrl: 'https://override.test/nz-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/nz-mfn.tar.gz',
      ftaUrl: 'https://override.test/nz-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.NZ_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/nz-mfn.tar.gz';
    process.env.NZ_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/nz-fta.xlsx';

    const urls = new Map<string, string>([
      [NZ_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/nz-mfn.tar.gz'],
      [NZ_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/nz-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveNzDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/nz-mfn.tar.gz',
      ftaUrl: 'https://registry.test/nz-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: NZ_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/nz-mfn.tar.gz',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: NZ_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/nz-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.NZ_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/nz-mfn.tar.gz';
    process.env.NZ_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/nz-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveNzDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/nz-mfn.tar.gz',
      ftaUrl: 'https://env.test/nz-fta.xlsx',
    });
  });
});
