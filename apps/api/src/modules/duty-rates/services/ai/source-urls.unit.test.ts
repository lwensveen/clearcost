import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  AI_FTA_OFFICIAL_SOURCE_KEY,
  AI_MFN_OFFICIAL_SOURCE_KEY,
  resolveAiDutySourceUrls,
} from './source-urls.js';

describe('resolveAiDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.AI_MFN_OFFICIAL_EXCEL_URL;
    delete process.env.AI_FTA_OFFICIAL_EXCEL_URL;
  });

  it('prefers explicit overrides', async () => {
    const out = await resolveAiDutySourceUrls({
      mfnUrl: 'https://override.test/ai-mfn.xlsx',
      ftaUrl: 'https://override.test/ai-fta.xlsx',
    });

    expect(out).toEqual({
      mfnUrl: 'https://override.test/ai-mfn.xlsx',
      ftaUrl: 'https://override.test/ai-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves from source registry with env fallback', async () => {
    process.env.AI_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ai-mfn.xlsx';
    process.env.AI_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ai-fta.xlsx';

    const urls = new Map<string, string>([
      [AI_MFN_OFFICIAL_SOURCE_KEY, 'https://registry.test/ai-mfn.xlsx'],
      [AI_FTA_OFFICIAL_SOURCE_KEY, 'https://registry.test/ai-fta.xlsx'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    const out = await resolveAiDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://registry.test/ai-mfn.xlsx',
      ftaUrl: 'https://registry.test/ai-fta.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AI_MFN_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ai-mfn.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: AI_FTA_OFFICIAL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/ai-fta.xlsx',
    });
  });

  it('falls back to env URLs when source registry resolution fails', async () => {
    process.env.AI_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ai-mfn.xlsx';
    process.env.AI_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ai-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing registry'));

    const out = await resolveAiDutySourceUrls();

    expect(out).toEqual({
      mfnUrl: 'https://env.test/ai-mfn.xlsx',
      ftaUrl: 'https://env.test/ai-fta.xlsx',
    });
  });
});
