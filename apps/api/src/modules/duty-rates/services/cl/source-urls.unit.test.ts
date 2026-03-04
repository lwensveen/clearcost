import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  CL_FTA_OFFICIAL_SOURCE_KEY,
  CL_MFN_OFFICIAL_SOURCE_KEY,
  resolveClDutySourceUrls,
} from './source-urls.js';

describe('resolveClDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.CL_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.CL_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveClDutySourceUrls({
      mfnUrl: 'https://override.test/cl-mfn.xlsx',
      ftaUrl: 'https://override.test/cl-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/cl-mfn.xlsx',
      ftaUrl: 'https://override.test/cl-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.CL_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/cl-mfn.xlsx';
    process.env.CL_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/cl-fta.xlsx';

    const urls = new Map<string, string>([
      [CL_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/cl-mfn.xlsx'],
      [CL_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/cl-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveClDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/cl-mfn.xlsx',
      ftaUrl: 'https://registry.test/cl-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: CL_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/cl-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: CL_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/cl-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.CL_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/cl-mfn.xlsx';
    process.env.CL_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/cl-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveClDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/cl-mfn.xlsx',
      ftaUrl: 'https://env.test/cl-fta.xlsx',
    });
  });
});
