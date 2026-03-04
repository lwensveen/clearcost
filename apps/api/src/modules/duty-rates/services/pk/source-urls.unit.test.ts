import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  PK_FTA_OFFICIAL_SOURCE_KEY,
  PK_MFN_OFFICIAL_SOURCE_KEY,
  resolvePkDutySourceUrls,
} from './source-urls.js';

describe('resolvePkDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.PK_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.PK_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolvePkDutySourceUrls({
      mfnUrl: 'https://override.test/pk-mfn.xlsx',
      ftaUrl: 'https://override.test/pk-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/pk-mfn.xlsx',
      ftaUrl: 'https://override.test/pk-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.PK_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/pk-mfn.xlsx';
    process.env.PK_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/pk-fta.xlsx';

    const urls = new Map<string, string>([
      [PK_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/pk-mfn.xlsx'],
      [PK_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/pk-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolvePkDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/pk-mfn.xlsx',
      ftaUrl: 'https://registry.test/pk-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: PK_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/pk-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: PK_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/pk-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.PK_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/pk-mfn.xlsx';
    process.env.PK_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/pk-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolvePkDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/pk-mfn.xlsx',
      ftaUrl: 'https://env.test/pk-fta.xlsx',
    });
  });
});
