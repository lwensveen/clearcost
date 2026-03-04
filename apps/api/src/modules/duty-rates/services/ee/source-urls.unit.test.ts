import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  EE_FTA_OFFICIAL_SOURCE_KEY,
  EE_MFN_OFFICIAL_SOURCE_KEY,
  resolveEeDutySourceUrls,
} from './source-urls.js';

describe('resolveEeDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.EE_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.EE_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveEeDutySourceUrls({
      mfnUrl: 'https://override.test/ee-mfn.xlsx',
      ftaUrl: 'https://override.test/ee-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/ee-mfn.xlsx',
      ftaUrl: 'https://override.test/ee-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.EE_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ee-mfn.xlsx';
    process.env.EE_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ee-fta.xlsx';

    const urls = new Map<string, string>([
      [EE_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/ee-mfn.xlsx'],
      [EE_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/ee-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveEeDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/ee-mfn.xlsx',
      ftaUrl: 'https://registry.test/ee-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: EE_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ee-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: EE_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ee-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.EE_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ee-mfn.xlsx';
    process.env.EE_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ee-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveEeDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/ee-mfn.xlsx',
      ftaUrl: 'https://env.test/ee-fta.xlsx',
    });
  });
});
