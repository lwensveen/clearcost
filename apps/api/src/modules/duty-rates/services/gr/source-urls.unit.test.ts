import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  GR_FTA_OFFICIAL_SOURCE_KEY,
  GR_MFN_OFFICIAL_SOURCE_KEY,
  resolveGrDutySourceUrls,
} from './source-urls.js';

describe('resolveGrDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.GR_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.GR_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveGrDutySourceUrls({
      mfnUrl: 'https://override.test/gr-mfn.xlsx',
      ftaUrl: 'https://override.test/gr-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/gr-mfn.xlsx',
      ftaUrl: 'https://override.test/gr-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.GR_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/gr-mfn.xlsx';
    process.env.GR_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/gr-fta.xlsx';

    const urls = new Map<string, string>([
      [GR_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/gr-mfn.xlsx'],
      [GR_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/gr-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveGrDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/gr-mfn.xlsx',
      ftaUrl: 'https://registry.test/gr-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: GR_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/gr-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: GR_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/gr-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.GR_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/gr-mfn.xlsx';
    process.env.GR_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/gr-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveGrDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/gr-mfn.xlsx',
      ftaUrl: 'https://env.test/gr-fta.xlsx',
    });
  });
});
