import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  AQ_FTA_OFFICIAL_SOURCE_KEY,
  AQ_MFN_OFFICIAL_SOURCE_KEY,
  resolveAqDutySourceUrls,
} from './source-urls.js';

describe('resolveAqDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.AQ_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.AQ_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveAqDutySourceUrls({
      mfnUrl: 'https://override.test/aq-mfn.xlsx',
      ftaUrl: 'https://override.test/aq-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/aq-mfn.xlsx',
      ftaUrl: 'https://override.test/aq-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.AQ_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/aq-mfn.xlsx';
    process.env.AQ_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/aq-fta.xlsx';

    const urls = new Map<string, string>([
      [AQ_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/aq-mfn.xlsx'],
      [AQ_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/aq-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveAqDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/aq-mfn.xlsx',
      ftaUrl: 'https://registry.test/aq-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AQ_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/aq-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AQ_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/aq-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.AQ_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/aq-mfn.xlsx';
    process.env.AQ_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/aq-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveAqDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/aq-mfn.xlsx',
      ftaUrl: 'https://env.test/aq-fta.xlsx',
    });
  });
});
