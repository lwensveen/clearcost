import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  MX_FTA_OFFICIAL_SOURCE_KEY,
  MX_MFN_OFFICIAL_SOURCE_KEY,
  resolveMxDutySourceUrls,
} from './source-urls.js';

describe('resolveMxDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.MX_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.MX_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveMxDutySourceUrls({
      mfnUrl: 'https://override.test/mx-mfn.xlsx',
      ftaUrl: 'https://override.test/mx-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/mx-mfn.xlsx',
      ftaUrl: 'https://override.test/mx-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.MX_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/mx-mfn.xlsx';
    process.env.MX_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/mx-fta.xlsx';

    const urls = new Map<string, string>([
      [MX_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/mx-mfn.xlsx'],
      [MX_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/mx-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveMxDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/mx-mfn.xlsx',
      ftaUrl: 'https://registry.test/mx-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: MX_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/mx-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: MX_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/mx-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.MX_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/mx-mfn.xlsx';
    process.env.MX_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/mx-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveMxDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/mx-mfn.xlsx',
      ftaUrl: 'https://env.test/mx-fta.xlsx',
    });
  });
});
