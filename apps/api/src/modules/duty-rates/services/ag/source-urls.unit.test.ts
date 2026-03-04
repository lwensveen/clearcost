import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  AG_FTA_OFFICIAL_SOURCE_KEY,
  AG_MFN_OFFICIAL_SOURCE_KEY,
  resolveAgDutySourceUrls,
} from './source-urls.js';

describe('resolveAgDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.AG_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.AG_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveAgDutySourceUrls({
      mfnUrl: 'https://override.test/ag-mfn.xlsx',
      ftaUrl: 'https://override.test/ag-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/ag-mfn.xlsx',
      ftaUrl: 'https://override.test/ag-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.AG_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ag-mfn.xlsx';
    process.env.AG_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ag-fta.xlsx';

    const urls = new Map<string, string>([
      [AG_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/ag-mfn.xlsx'],
      [AG_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/ag-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveAgDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/ag-mfn.xlsx',
      ftaUrl: 'https://registry.test/ag-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AG_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ag-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AG_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ag-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.AG_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ag-mfn.xlsx';
    process.env.AG_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ag-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveAgDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/ag-mfn.xlsx',
      ftaUrl: 'https://env.test/ag-fta.xlsx',
    });
  });
});
