import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  RU_FTA_OFFICIAL_SOURCE_KEY,
  RU_MFN_OFFICIAL_SOURCE_KEY,
  resolveRuDutySourceUrls,
} from './source-urls.js';

describe('resolveRuDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.RU_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.RU_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveRuDutySourceUrls({
      mfnUrl: 'https://override.test/ru-mfn.xlsx',
      ftaUrl: 'https://override.test/ru-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/ru-mfn.xlsx',
      ftaUrl: 'https://override.test/ru-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.RU_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ru-mfn.xlsx';
    process.env.RU_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ru-fta.xlsx';

    const urls = new Map<string, string>([
      [RU_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/ru-mfn.xlsx'],
      [RU_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/ru-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveRuDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/ru-mfn.xlsx',
      ftaUrl: 'https://registry.test/ru-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: RU_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ru-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: RU_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ru-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.RU_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ru-mfn.xlsx';
    process.env.RU_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ru-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveRuDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/ru-mfn.xlsx',
      ftaUrl: 'https://env.test/ru-fta.xlsx',
    });
  });
});
