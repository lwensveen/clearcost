import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  PT_FTA_OFFICIAL_SOURCE_KEY,
  PT_MFN_OFFICIAL_SOURCE_KEY,
  resolvePtDutySourceUrls,
} from './source-urls.js';

describe('resolvePtDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.PT_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.PT_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolvePtDutySourceUrls({
      mfnUrl: 'https://override.test/pt-mfn.xlsx',
      ftaUrl: 'https://override.test/pt-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/pt-mfn.xlsx',
      ftaUrl: 'https://override.test/pt-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.PT_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/pt-mfn.xlsx';
    process.env.PT_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/pt-fta.xlsx';

    const urls = new Map<string, string>([
      [PT_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/pt-mfn.xlsx'],
      [PT_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/pt-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolvePtDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/pt-mfn.xlsx',
      ftaUrl: 'https://registry.test/pt-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: PT_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/pt-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: PT_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/pt-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.PT_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/pt-mfn.xlsx';
    process.env.PT_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/pt-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolvePtDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/pt-mfn.xlsx',
      ftaUrl: 'https://env.test/pt-fta.xlsx',
    });
  });
});
