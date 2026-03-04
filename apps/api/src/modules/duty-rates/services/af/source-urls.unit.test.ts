import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  AF_FTA_OFFICIAL_SOURCE_KEY,
  AF_MFN_OFFICIAL_SOURCE_KEY,
  resolveAfDutySourceUrls,
} from './source-urls.js';

describe('resolveAfDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.AF_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.AF_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveAfDutySourceUrls({
      mfnUrl: 'https://override.test/af-mfn.xlsx',
      ftaUrl: 'https://override.test/af-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/af-mfn.xlsx',
      ftaUrl: 'https://override.test/af-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.AF_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/af-mfn.xlsx';
    process.env.AF_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/af-fta.xlsx';

    const urls = new Map<string, string>([
      [AF_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/af-mfn.xlsx'],
      [AF_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/af-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveAfDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/af-mfn.xlsx',
      ftaUrl: 'https://registry.test/af-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AF_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/af-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AF_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/af-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.AF_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/af-mfn.xlsx';
    process.env.AF_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/af-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveAfDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/af-mfn.xlsx',
      ftaUrl: 'https://env.test/af-fta.xlsx',
    });
  });
});
