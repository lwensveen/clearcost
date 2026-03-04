import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  HR_FTA_OFFICIAL_SOURCE_KEY,
  HR_MFN_OFFICIAL_SOURCE_KEY,
  resolveHrDutySourceUrls,
} from './source-urls.js';

describe('resolveHrDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.HR_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.HR_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveHrDutySourceUrls({
      mfnUrl: 'https://override.test/hr-mfn.xlsx',
      ftaUrl: 'https://override.test/hr-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/hr-mfn.xlsx',
      ftaUrl: 'https://override.test/hr-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.HR_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/hr-mfn.xlsx';
    process.env.HR_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/hr-fta.xlsx';

    const urls = new Map<string, string>([
      [HR_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/hr-mfn.xlsx'],
      [HR_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/hr-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveHrDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/hr-mfn.xlsx',
      ftaUrl: 'https://registry.test/hr-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: HR_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/hr-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: HR_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/hr-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.HR_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/hr-mfn.xlsx';
    process.env.HR_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/hr-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveHrDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/hr-mfn.xlsx',
      ftaUrl: 'https://env.test/hr-fta.xlsx',
    });
  });
});
