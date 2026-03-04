import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  UA_FTA_OFFICIAL_SOURCE_KEY,
  UA_MFN_OFFICIAL_SOURCE_KEY,
  resolveUaDutySourceUrls,
} from './source-urls.js';

describe('resolveUaDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.UA_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.UA_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveUaDutySourceUrls({
      mfnUrl: 'https://override.test/ua-mfn.xlsx',
      ftaUrl: 'https://override.test/ua-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/ua-mfn.xlsx',
      ftaUrl: 'https://override.test/ua-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.UA_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ua-mfn.xlsx';
    process.env.UA_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ua-fta.xlsx';

    const urls = new Map<string, string>([
      [UA_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/ua-mfn.xlsx'],
      [UA_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/ua-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveUaDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/ua-mfn.xlsx',
      ftaUrl: 'https://registry.test/ua-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: UA_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ua-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: UA_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ua-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.UA_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ua-mfn.xlsx';
    process.env.UA_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ua-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveUaDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/ua-mfn.xlsx',
      ftaUrl: 'https://env.test/ua-fta.xlsx',
    });
  });
});
