import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  CO_FTA_OFFICIAL_SOURCE_KEY,
  CO_MFN_OFFICIAL_SOURCE_KEY,
  resolveCoDutySourceUrls,
} from './source-urls.js';

describe('resolveCoDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.CO_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.CO_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveCoDutySourceUrls({
      mfnUrl: 'https://override.test/co-mfn.xlsx',
      ftaUrl: 'https://override.test/co-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/co-mfn.xlsx',
      ftaUrl: 'https://override.test/co-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.CO_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/co-mfn.xlsx';
    process.env.CO_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/co-fta.xlsx';

    const urls = new Map<string, string>([
      [CO_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/co-mfn.xlsx'],
      [CO_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/co-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveCoDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/co-mfn.xlsx',
      ftaUrl: 'https://registry.test/co-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: CO_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/co-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: CO_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/co-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.CO_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/co-mfn.xlsx';
    process.env.CO_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/co-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveCoDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/co-mfn.xlsx',
      ftaUrl: 'https://env.test/co-fta.xlsx',
    });
  });
});
