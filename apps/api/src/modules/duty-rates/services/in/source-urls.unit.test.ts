import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  IN_FTA_OFFICIAL_SOURCE_KEY,
  IN_MFN_OFFICIAL_SOURCE_KEY,
  resolveInDutySourceUrls,
} from './source-urls.js';

describe('resolveInDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.IN_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.IN_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveInDutySourceUrls({
      mfnUrl: 'https://override.test/in-mfn.xlsx',
      ftaUrl: 'https://override.test/in-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/in-mfn.xlsx',
      ftaUrl: 'https://override.test/in-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.IN_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/in-mfn.xlsx';
    process.env.IN_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/in-fta.xlsx';

    const urls = new Map<string, string>([
      [IN_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/in-mfn.xlsx'],
      [IN_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/in-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveInDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/in-mfn.xlsx',
      ftaUrl: 'https://registry.test/in-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: IN_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/in-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: IN_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/in-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.IN_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/in-mfn.xlsx';
    process.env.IN_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/in-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveInDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/in-mfn.xlsx',
      ftaUrl: 'https://env.test/in-fta.xlsx',
    });
  });
});
