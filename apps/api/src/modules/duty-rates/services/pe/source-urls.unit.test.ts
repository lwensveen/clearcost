import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  PE_FTA_OFFICIAL_SOURCE_KEY,
  PE_MFN_OFFICIAL_SOURCE_KEY,
  resolvePeDutySourceUrls,
} from './source-urls.js';

describe('resolvePeDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.PE_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.PE_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolvePeDutySourceUrls({
      mfnUrl: 'https://override.test/pe-mfn.xlsx',
      ftaUrl: 'https://override.test/pe-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/pe-mfn.xlsx',
      ftaUrl: 'https://override.test/pe-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.PE_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/pe-mfn.xlsx';
    process.env.PE_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/pe-fta.xlsx';

    const urls = new Map<string, string>([
      [PE_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/pe-mfn.xlsx'],
      [PE_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/pe-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolvePeDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/pe-mfn.xlsx',
      ftaUrl: 'https://registry.test/pe-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: PE_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/pe-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: PE_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/pe-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.PE_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/pe-mfn.xlsx';
    process.env.PE_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/pe-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolvePeDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/pe-mfn.xlsx',
      ftaUrl: 'https://env.test/pe-fta.xlsx',
    });
  });
});
