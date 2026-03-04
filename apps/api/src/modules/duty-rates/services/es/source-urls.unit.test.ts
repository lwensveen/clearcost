import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  ES_FTA_OFFICIAL_SOURCE_KEY,
  ES_MFN_OFFICIAL_SOURCE_KEY,
  resolveEsDutySourceUrls,
} from './source-urls.js';

describe('resolveEsDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.ES_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.ES_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveEsDutySourceUrls({
      mfnUrl: 'https://override.test/es-mfn.xlsx',
      ftaUrl: 'https://override.test/es-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/es-mfn.xlsx',
      ftaUrl: 'https://override.test/es-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.ES_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/es-mfn.xlsx';
    process.env.ES_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/es-fta.xlsx';

    const urls = new Map<string, string>([
      [ES_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/es-mfn.xlsx'],
      [ES_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/es-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveEsDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/es-mfn.xlsx',
      ftaUrl: 'https://registry.test/es-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: ES_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/es-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: ES_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/es-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.ES_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/es-mfn.xlsx';
    process.env.ES_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/es-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveEsDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/es-mfn.xlsx',
      ftaUrl: 'https://env.test/es-fta.xlsx',
    });
  });
});
