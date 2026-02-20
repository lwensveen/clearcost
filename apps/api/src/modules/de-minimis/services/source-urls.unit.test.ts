import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  DEFAULT_OFFICIAL_DE_MINIMIS_SOURCE_URLS,
  DEFAULT_TRADE_GOV_DE_MINIMIS_API_BASE,
  DEFAULT_ZONOS_DE_MINIMIS_URL,
  resolveOfficialDeMinimisSourceUrls,
  resolveTradeGovDeMinimisApiBase,
  resolveZonosDeMinimisUrl,
} from './source-urls.js';

describe('de-minimis source URL resolution', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('uses override URLs directly', async () => {
    const zonos = await resolveZonosDeMinimisUrl('https://override.test/zonos');
    const tradeGov = await resolveTradeGovDeMinimisApiBase('https://override.test/trade-gov');

    expect(zonos).toBe('https://override.test/zonos');
    expect(tradeGov).toBe('https://override.test/trade-gov');
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves zonos and trade.gov from source registry with fallback defaults', async () => {
    mocks.resolveSourceDownloadUrlMock
      .mockResolvedValueOnce('https://registry.test/zonos')
      .mockResolvedValueOnce('https://registry.test/trade-gov');

    const zonos = await resolveZonosDeMinimisUrl();
    const tradeGov = await resolveTradeGovDeMinimisApiBase();

    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenNthCalledWith(1, {
      sourceKey: 'de-minimis.zonos.docs',
      fallbackUrl: DEFAULT_ZONOS_DE_MINIMIS_URL,
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenNthCalledWith(2, {
      sourceKey: 'de-minimis.trade_gov.api',
      fallbackUrl: DEFAULT_TRADE_GOV_DE_MINIMIS_API_BASE,
    });
    expect(zonos).toBe('https://registry.test/zonos');
    expect(tradeGov).toBe('https://registry.test/trade-gov');
  });

  it('returns official defaults when source registry lookup throws', async () => {
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('boom'));

    const out = await resolveOfficialDeMinimisSourceUrls();

    expect(out).toEqual({
      usSection321: DEFAULT_OFFICIAL_DE_MINIMIS_SOURCE_URLS.usSection321,
      euRegulation: DEFAULT_OFFICIAL_DE_MINIMIS_SOURCE_URLS.euRegulation,
      gbVatGuidance: DEFAULT_OFFICIAL_DE_MINIMIS_SOURCE_URLS.gbVatGuidance,
      caLvsVat: DEFAULT_OFFICIAL_DE_MINIMIS_SOURCE_URLS.caLvsVat,
      caLvsDuty: DEFAULT_OFFICIAL_DE_MINIMIS_SOURCE_URLS.caLvsDuty,
    });
  });
});
