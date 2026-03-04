import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  LT_FTA_OFFICIAL_SOURCE_KEY,
  LT_MFN_OFFICIAL_SOURCE_KEY,
  resolveLtDutySourceUrls,
} from './source-urls.js';

describe('resolveLtDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.LT_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.LT_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveLtDutySourceUrls({
      mfnUrl: 'https://override.test/lt-mfn.xlsx',
      ftaUrl: 'https://override.test/lt-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/lt-mfn.xlsx',
      ftaUrl: 'https://override.test/lt-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.LT_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/lt-mfn.xlsx';
    process.env.LT_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/lt-fta.xlsx';

    const urls = new Map<string, string>([
      [LT_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/lt-mfn.xlsx'],
      [LT_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/lt-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveLtDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/lt-mfn.xlsx',
      ftaUrl: 'https://registry.test/lt-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: LT_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/lt-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: LT_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/lt-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.LT_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/lt-mfn.xlsx';
    process.env.LT_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/lt-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveLtDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/lt-mfn.xlsx',
      ftaUrl: 'https://env.test/lt-fta.xlsx',
    });
  });
});
