import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  CZ_FTA_OFFICIAL_SOURCE_KEY,
  CZ_MFN_OFFICIAL_SOURCE_KEY,
  resolveCzDutySourceUrls,
} from './source-urls.js';

describe('resolveCzDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.CZ_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.CZ_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveCzDutySourceUrls({
      mfnUrl: 'https://override.test/cz-mfn.xlsx',
      ftaUrl: 'https://override.test/cz-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/cz-mfn.xlsx',
      ftaUrl: 'https://override.test/cz-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.CZ_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/cz-mfn.xlsx';
    process.env.CZ_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/cz-fta.xlsx';

    const urls = new Map<string, string>([
      [CZ_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/cz-mfn.xlsx'],
      [CZ_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/cz-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveCzDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/cz-mfn.xlsx',
      ftaUrl: 'https://registry.test/cz-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: CZ_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/cz-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: CZ_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/cz-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.CZ_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/cz-mfn.xlsx';
    process.env.CZ_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/cz-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveCzDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/cz-mfn.xlsx',
      ftaUrl: 'https://env.test/cz-fta.xlsx',
    });
  });
});
