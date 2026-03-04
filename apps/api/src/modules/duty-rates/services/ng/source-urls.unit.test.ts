import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  NG_FTA_OFFICIAL_SOURCE_KEY,
  NG_MFN_OFFICIAL_SOURCE_KEY,
  resolveNgDutySourceUrls,
} from './source-urls.js';

describe('resolveNgDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.NG_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.NG_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveNgDutySourceUrls({
      mfnUrl: 'https://override.test/ng-mfn.xlsx',
      ftaUrl: 'https://override.test/ng-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/ng-mfn.xlsx',
      ftaUrl: 'https://override.test/ng-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.NG_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ng-mfn.xlsx';
    process.env.NG_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ng-fta.xlsx';

    const urls = new Map<string, string>([
      [NG_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/ng-mfn.xlsx'],
      [NG_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/ng-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveNgDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/ng-mfn.xlsx',
      ftaUrl: 'https://registry.test/ng-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: NG_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ng-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: NG_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ng-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.NG_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ng-mfn.xlsx';
    process.env.NG_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ng-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveNgDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/ng-mfn.xlsx',
      ftaUrl: 'https://env.test/ng-fta.xlsx',
    });
  });
});
