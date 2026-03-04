import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  CY_FTA_OFFICIAL_SOURCE_KEY,
  CY_MFN_OFFICIAL_SOURCE_KEY,
  resolveCyDutySourceUrls,
} from './source-urls.js';

describe('resolveCyDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.CY_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.CY_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveCyDutySourceUrls({
      mfnUrl: 'https://override.test/cy-mfn.xlsx',
      ftaUrl: 'https://override.test/cy-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/cy-mfn.xlsx',
      ftaUrl: 'https://override.test/cy-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.CY_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/cy-mfn.xlsx';
    process.env.CY_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/cy-fta.xlsx';

    const urls = new Map<string, string>([
      [CY_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/cy-mfn.xlsx'],
      [CY_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/cy-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveCyDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/cy-mfn.xlsx',
      ftaUrl: 'https://registry.test/cy-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: CY_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/cy-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: CY_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/cy-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.CY_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/cy-mfn.xlsx';
    process.env.CY_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/cy-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveCyDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/cy-mfn.xlsx',
      ftaUrl: 'https://env.test/cy-fta.xlsx',
    });
  });
});
