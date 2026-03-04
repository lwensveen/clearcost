import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  AS_FTA_OFFICIAL_SOURCE_KEY,
  AS_MFN_OFFICIAL_SOURCE_KEY,
  resolveAsDutySourceUrls,
} from './source-urls.js';

describe('resolveAsDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.AS_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.AS_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveAsDutySourceUrls({
      mfnUrl: 'https://override.test/as-mfn.xlsx',
      ftaUrl: 'https://override.test/as-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/as-mfn.xlsx',
      ftaUrl: 'https://override.test/as-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.AS_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/as-mfn.xlsx';
    process.env.AS_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/as-fta.xlsx';

    const urls = new Map<string, string>([
      [AS_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/as-mfn.xlsx'],
      [AS_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/as-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveAsDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/as-mfn.xlsx',
      ftaUrl: 'https://registry.test/as-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AS_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/as-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AS_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/as-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.AS_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/as-mfn.xlsx';
    process.env.AS_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/as-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveAsDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/as-mfn.xlsx',
      ftaUrl: 'https://env.test/as-fta.xlsx',
    });
  });
});
