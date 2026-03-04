import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  AL_FTA_OFFICIAL_SOURCE_KEY,
  AL_MFN_OFFICIAL_SOURCE_KEY,
  resolveAlDutySourceUrls,
} from './source-urls.js';

describe('resolveAlDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.AL_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.AL_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveAlDutySourceUrls({
      mfnUrl: 'https://override.test/al-mfn.xlsx',
      ftaUrl: 'https://override.test/al-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/al-mfn.xlsx',
      ftaUrl: 'https://override.test/al-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.AL_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/al-mfn.xlsx';
    process.env.AL_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/al-fta.xlsx';

    const urls = new Map<string, string>([
      [AL_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/al-mfn.xlsx'],
      [AL_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/al-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveAlDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/al-mfn.xlsx',
      ftaUrl: 'https://registry.test/al-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AL_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/al-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AL_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/al-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.AL_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/al-mfn.xlsx';
    process.env.AL_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/al-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveAlDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/al-mfn.xlsx',
      ftaUrl: 'https://env.test/al-fta.xlsx',
    });
  });
});
