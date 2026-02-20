import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import { resolveJpTariffDutySourceUrls } from './source-urls.js';

describe('resolveJpTariffDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.JP_TARIFF_INDEX = '';
    mocks.resolveSourceDownloadUrlMock.mockResolvedValue('');
  });

  it('uses explicit override without querying source registry', async () => {
    const out = await resolveJpTariffDutySourceUrls({ tariffIndexUrl: 'https://override.test' });

    expect(out).toEqual({ tariffIndexUrl: 'https://override.test' });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves JP tariff index URL from source registry with env fallback', async () => {
    process.env.JP_TARIFF_INDEX = 'https://env.test/jp';
    mocks.resolveSourceDownloadUrlMock.mockResolvedValue('https://registry.test/jp');

    const out = await resolveJpTariffDutySourceUrls();

    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: 'duties.jp.customs.tariff_index',
      fallbackUrl: 'https://env.test/jp',
    });
    expect(out).toEqual({ tariffIndexUrl: 'https://registry.test/jp' });
  });

  it('falls back to env when source registry resolution fails', async () => {
    process.env.JP_TARIFF_INDEX = 'https://env.test/jp';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('source not configured'));

    const out = await resolveJpTariffDutySourceUrls();

    expect(out).toEqual({ tariffIndexUrl: 'https://env.test/jp' });
  });
});
