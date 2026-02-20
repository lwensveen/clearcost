import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import { resolveVatOfficialSourceUrls } from './source-urls.js';

describe('resolveVatOfficialSourceUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.resolveSourceDownloadUrlMock.mockResolvedValue('');
  });

  it('uses explicit overrides without querying source registry', async () => {
    const out = await resolveVatOfficialSourceUrls({
      oecdXlsxUrl: 'https://override.test/oecd.xlsx',
      imfXlsxUrl: 'https://override.test/imf.xlsx',
    });

    expect(out).toEqual({
      oecdXlsxUrl: 'https://override.test/oecd.xlsx',
      imfXlsxUrl: 'https://override.test/imf.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves OECD + IMF URLs from source registry', async () => {
    mocks.resolveSourceDownloadUrlMock
      .mockResolvedValueOnce('https://registry.test/oecd.xlsx')
      .mockResolvedValueOnce('https://registry.test/imf.xlsx');

    const out = await resolveVatOfficialSourceUrls();

    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenNthCalledWith(1, {
      sourceKey: 'vat.oecd_imf.standard',
      fallbackUrl:
        'https://www.oecd.org/content/dam/oecd/en/topics/policy-sub-issues/consumption-tax-trends/vat-gst-rates-ctt-trends.xlsx',
    });
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenNthCalledWith(2, {
      sourceKey: 'vat.imf.standard',
      fallbackUrl: 'https://www.imf.org/external/np/fad/tpaf/files/vat_substandard_rates.xlsx',
    });
    expect(out).toEqual({
      oecdXlsxUrl: 'https://registry.test/oecd.xlsx',
      imfXlsxUrl: 'https://registry.test/imf.xlsx',
    });
  });

  it('falls back per source when registry resolution fails', async () => {
    mocks.resolveSourceDownloadUrlMock
      .mockRejectedValueOnce(new Error('missing oecd source'))
      .mockResolvedValueOnce('https://registry.test/imf.xlsx');

    const out = await resolveVatOfficialSourceUrls();

    expect(out).toEqual({
      oecdXlsxUrl:
        'https://www.oecd.org/content/dam/oecd/en/topics/policy-sub-issues/consumption-tax-trends/vat-gst-rates-ctt-trends.xlsx',
      imfXlsxUrl: 'https://registry.test/imf.xlsx',
    });
  });
});
