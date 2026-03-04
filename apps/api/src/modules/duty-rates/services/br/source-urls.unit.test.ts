import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  BR_FTA_OFFICIAL_SOURCE_KEY,
  BR_MFN_OFFICIAL_SOURCE_KEY,
  resolveBrDutySourceUrls,
} from './source-urls.js';

describe('resolveBrDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.BR_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.BR_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveBrDutySourceUrls({
      mfnUrl: 'https://override.test/br-mfn.xlsx',
      ftaUrl: 'https://override.test/br-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/br-mfn.xlsx',
      ftaUrl: 'https://override.test/br-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.BR_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/br-mfn.xlsx';
    process.env.BR_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/br-fta.xlsx';

    const urls = new Map<string, string>([
      [BR_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/br-mfn.xlsx'],
      [BR_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/br-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveBrDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/br-mfn.xlsx',
      ftaUrl: 'https://registry.test/br-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: BR_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/br-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: BR_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/br-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.BR_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/br-mfn.xlsx';
    process.env.BR_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/br-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveBrDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/br-mfn.xlsx',
      ftaUrl: 'https://env.test/br-fta.xlsx',
    });
  });
});
