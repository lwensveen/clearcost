import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  DE_FTA_OFFICIAL_SOURCE_KEY,
  DE_MFN_OFFICIAL_SOURCE_KEY,
  resolveDeDutySourceUrls,
} from './source-urls.js';

describe('resolveDeDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.DE_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.DE_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveDeDutySourceUrls({
      mfnUrl: 'https://override.test/de-mfn.xlsx',
      ftaUrl: 'https://override.test/de-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/de-mfn.xlsx',
      ftaUrl: 'https://override.test/de-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.DE_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/de-mfn.xlsx';
    process.env.DE_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/de-fta.xlsx';

    const urls = new Map<string, string>([
      [DE_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/de-mfn.xlsx'],
      [DE_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/de-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveDeDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/de-mfn.xlsx',
      ftaUrl: 'https://registry.test/de-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: DE_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/de-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: DE_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/de-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.DE_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/de-mfn.xlsx';
    process.env.DE_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/de-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveDeDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/de-mfn.xlsx',
      ftaUrl: 'https://env.test/de-fta.xlsx',
    });
  });
});
