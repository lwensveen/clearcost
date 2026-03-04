import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  NL_FTA_OFFICIAL_SOURCE_KEY,
  NL_MFN_OFFICIAL_SOURCE_KEY,
  resolveNlDutySourceUrls,
} from './source-urls.js';

describe('resolveNlDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.NL_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.NL_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveNlDutySourceUrls({
      mfnUrl: 'https://override.test/nl-mfn.xlsx',
      ftaUrl: 'https://override.test/nl-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/nl-mfn.xlsx',
      ftaUrl: 'https://override.test/nl-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.NL_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/nl-mfn.xlsx';
    process.env.NL_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/nl-fta.xlsx';

    const urls = new Map<string, string>([
      [NL_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/nl-mfn.xlsx'],
      [NL_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/nl-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveNlDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/nl-mfn.xlsx',
      ftaUrl: 'https://registry.test/nl-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: NL_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/nl-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: NL_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/nl-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.NL_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/nl-mfn.xlsx';
    process.env.NL_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/nl-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveNlDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/nl-mfn.xlsx',
      ftaUrl: 'https://env.test/nl-fta.xlsx',
    });
  });
});
