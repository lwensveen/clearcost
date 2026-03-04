import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  EG_FTA_OFFICIAL_SOURCE_KEY,
  EG_MFN_OFFICIAL_SOURCE_KEY,
  resolveEgDutySourceUrls,
} from './source-urls.js';

describe('resolveEgDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.EG_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.EG_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveEgDutySourceUrls({
      mfnUrl: 'https://override.test/eg-mfn.xlsx',
      ftaUrl: 'https://override.test/eg-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/eg-mfn.xlsx',
      ftaUrl: 'https://override.test/eg-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.EG_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/eg-mfn.xlsx';
    process.env.EG_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/eg-fta.xlsx';

    const urls = new Map<string, string>([
      [EG_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/eg-mfn.xlsx'],
      [EG_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/eg-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveEgDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/eg-mfn.xlsx',
      ftaUrl: 'https://registry.test/eg-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: EG_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/eg-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: EG_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/eg-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.EG_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/eg-mfn.xlsx';
    process.env.EG_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/eg-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveEgDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/eg-mfn.xlsx',
      ftaUrl: 'https://env.test/eg-fta.xlsx',
    });
  });
});
