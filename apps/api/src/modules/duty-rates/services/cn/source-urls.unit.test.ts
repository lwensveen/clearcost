import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  CN_FTA_OFFICIAL_EXCEL_SOURCE_KEY,
  resolveCnPreferentialDutySourceUrls,
} from './source-urls.js';

describe('resolveCnPreferentialDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.CN_FTA_OFFICIAL_EXCEL_URL = '';
    mocks.resolveSourceDownloadUrlMock.mockResolvedValue('');
  });

  it('uses explicit override without querying source registry', async () => {
    const out = await resolveCnPreferentialDutySourceUrls({
      ftaExcelUrl: 'https://override.test/cn-fta.xlsx',
    });

    expect(out).toEqual({ ftaExcelUrl: 'https://override.test/cn-fta.xlsx' });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves official CN FTA URL from source registry with env fallback', async () => {
    process.env.CN_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/cn-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockResolvedValue('https://registry.test/cn-fta.xlsx');

    const out = await resolveCnPreferentialDutySourceUrls();

    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: CN_FTA_OFFICIAL_EXCEL_SOURCE_KEY,
      fallbackUrl: 'https://env.test/cn-fta.xlsx',
    });
    expect(out).toEqual({ ftaExcelUrl: 'https://registry.test/cn-fta.xlsx' });
  });

  it('falls back to env when source registry resolution fails', async () => {
    process.env.CN_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/cn-fta.xlsx';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('missing source key'));

    const out = await resolveCnPreferentialDutySourceUrls();

    expect(out).toEqual({ ftaExcelUrl: 'https://env.test/cn-fta.xlsx' });
  });
});
