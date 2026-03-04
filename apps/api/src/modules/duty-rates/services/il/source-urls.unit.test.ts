import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  IL_FTA_OFFICIAL_SOURCE_KEY,
  IL_MFN_OFFICIAL_SOURCE_KEY,
  resolveIlDutySourceUrls,
} from './source-urls.js';

describe('resolveIlDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.IL_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.IL_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveIlDutySourceUrls({
      mfnUrl: 'https://override.test/il-mfn.xlsx',
      ftaUrl: 'https://override.test/il-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/il-mfn.xlsx',
      ftaUrl: 'https://override.test/il-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.IL_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/il-mfn.xlsx';
    process.env.IL_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/il-fta.xlsx';

    const urls = new Map<string, string>([
      [IL_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/il-mfn.xlsx'],
      [IL_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/il-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveIlDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/il-mfn.xlsx',
      ftaUrl: 'https://registry.test/il-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: IL_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/il-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: IL_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/il-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.IL_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/il-mfn.xlsx';
    process.env.IL_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/il-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveIlDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/il-mfn.xlsx',
      ftaUrl: 'https://env.test/il-fta.xlsx',
    });
  });
});
