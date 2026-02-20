import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import { resolveWitsDutySourceUrls } from './source-urls.js';

describe('resolveWitsDutySourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.WITS_SDMX_BASE = '';
    mocks.resolveSourceDownloadUrlMock.mockResolvedValue('');
  });

  it('uses explicit override without querying source registry', async () => {
    const out = await resolveWitsDutySourceUrls({
      sdmxBaseUrl: 'https://override.test/wits',
    });

    expect(out).toEqual({ sdmxBaseUrl: 'https://override.test/wits' });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves WITS SDMX base from source registry with env fallback', async () => {
    process.env.WITS_SDMX_BASE = 'https://env.test/wits';
    mocks.resolveSourceDownloadUrlMock.mockResolvedValue('https://registry.test/wits');

    const out = await resolveWitsDutySourceUrls();

    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: 'duties.wits.sdmx.base',
      fallbackUrl: 'https://env.test/wits',
    });
    expect(out).toEqual({ sdmxBaseUrl: 'https://registry.test/wits' });
  });

  it('falls back to env when source registry resolution fails', async () => {
    process.env.WITS_SDMX_BASE = 'https://env.test/wits';
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('source not configured'));

    const out = await resolveWitsDutySourceUrls();

    expect(out).toEqual({ sdmxBaseUrl: 'https://env.test/wits' });
  });
});
