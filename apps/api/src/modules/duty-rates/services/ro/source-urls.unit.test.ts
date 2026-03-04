import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  RO_FTA_OFFICIAL_SOURCE_KEY,
  RO_MFN_OFFICIAL_SOURCE_KEY,
  resolveRoDutySourceUrls,
} from './source-urls.js';

describe('resolveRoDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.RO_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.RO_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveRoDutySourceUrls({
      mfnUrl: 'https://override.test/ro-mfn.xlsx',
      ftaUrl: 'https://override.test/ro-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/ro-mfn.xlsx',
      ftaUrl: 'https://override.test/ro-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.RO_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ro-mfn.xlsx';
    process.env.RO_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ro-fta.xlsx';

    const urls = new Map<string, string>([
      [RO_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/ro-mfn.xlsx'],
      [RO_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/ro-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveRoDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/ro-mfn.xlsx',
      ftaUrl: 'https://registry.test/ro-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: RO_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ro-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: RO_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ro-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.RO_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ro-mfn.xlsx';
    process.env.RO_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ro-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveRoDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/ro-mfn.xlsx',
      ftaUrl: 'https://env.test/ro-fta.xlsx',
    });
  });
});
