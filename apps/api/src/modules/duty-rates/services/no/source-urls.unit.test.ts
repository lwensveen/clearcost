import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  NO_FTA_OFFICIAL_SOURCE_KEY,
  NO_MFN_OFFICIAL_SOURCE_KEY,
  resolveNoDutySourceUrls,
} from './source-urls.js';

describe('resolveNoDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.NO_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.NO_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveNoDutySourceUrls({
      mfnUrl: 'https://override.test/no-mfn.xlsx',
      ftaUrl: 'https://override.test/no-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/no-mfn.xlsx',
      ftaUrl: 'https://override.test/no-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.NO_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/no-mfn.xlsx';
    process.env.NO_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/no-fta.xlsx';

    const urls = new Map<string, string>([
      [NO_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/no-mfn.xlsx'],
      [NO_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/no-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveNoDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/no-mfn.xlsx',
      ftaUrl: 'https://registry.test/no-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: NO_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/no-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: NO_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/no-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.NO_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/no-mfn.xlsx';
    process.env.NO_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/no-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveNoDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/no-mfn.xlsx',
      ftaUrl: 'https://env.test/no-fta.xlsx',
    });
  });
});
