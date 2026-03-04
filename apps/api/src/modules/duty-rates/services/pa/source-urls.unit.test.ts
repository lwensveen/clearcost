import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  PA_FTA_OFFICIAL_SOURCE_KEY,
  PA_MFN_OFFICIAL_SOURCE_KEY,
  resolvePaDutySourceUrls,
} from './source-urls.js';

describe('resolvePaDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.PA_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.PA_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolvePaDutySourceUrls({
      mfnUrl: 'https://override.test/pa-mfn.xlsx',
      ftaUrl: 'https://override.test/pa-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/pa-mfn.xlsx',
      ftaUrl: 'https://override.test/pa-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.PA_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/pa-mfn.xlsx';
    process.env.PA_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/pa-fta.xlsx';

    const urls = new Map<string, string>([
      [PA_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/pa-mfn.xlsx'],
      [PA_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/pa-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolvePaDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/pa-mfn.xlsx',
      ftaUrl: 'https://registry.test/pa-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: PA_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/pa-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: PA_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/pa-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.PA_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/pa-mfn.xlsx';
    process.env.PA_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/pa-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolvePaDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/pa-mfn.xlsx',
      ftaUrl: 'https://env.test/pa-fta.xlsx',
    });
  });
});
