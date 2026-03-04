import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  AW_FTA_OFFICIAL_SOURCE_KEY,
  AW_MFN_OFFICIAL_SOURCE_KEY,
  resolveAwDutySourceUrls,
} from './source-urls.js';

describe('resolveAwDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.AW_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.AW_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveAwDutySourceUrls({
      mfnUrl: 'https://override.test/aw-mfn.xlsx',
      ftaUrl: 'https://override.test/aw-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/aw-mfn.xlsx',
      ftaUrl: 'https://override.test/aw-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.AW_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/aw-mfn.xlsx';
    process.env.AW_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/aw-fta.xlsx';

    const urls = new Map<string, string>([
      [AW_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/aw-mfn.xlsx'],
      [AW_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/aw-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveAwDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/aw-mfn.xlsx',
      ftaUrl: 'https://registry.test/aw-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AW_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/aw-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AW_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/aw-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.AW_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/aw-mfn.xlsx';
    process.env.AW_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/aw-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveAwDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/aw-mfn.xlsx',
      ftaUrl: 'https://env.test/aw-fta.xlsx',
    });
  });
});
