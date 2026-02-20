import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import { resolveAseanDutySourceUrl } from './source-urls.js';

describe('resolveAseanDutySourceUrl', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.resolveSourceDownloadUrlMock.mockResolvedValue('https://resolved.test/source.xlsx');
  });

  it('resolves with source key only when no fallback URL is provided', async () => {
    const out = await resolveAseanDutySourceUrl({
      sourceKey: 'duties.my.official.mfn_excel',
    });

    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: 'duties.my.official.mfn_excel',
    });
    expect(out).toBe('https://resolved.test/source.xlsx');
  });

  it('passes fallback URL when provided', async () => {
    const out = await resolveAseanDutySourceUrl({
      sourceKey: 'duties.ph.tariff_commission.xlsx',
      fallbackUrl: 'https://fallback.test/ph.xlsx',
    });

    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: 'duties.ph.tariff_commission.xlsx',
      fallbackUrl: 'https://fallback.test/ph.xlsx',
    });
    expect(out).toBe('https://resolved.test/source.xlsx');
  });

  it('ignores empty fallback URLs', async () => {
    const out = await resolveAseanDutySourceUrl({
      sourceKey: 'duties.vn.official.fta_excel',
      fallbackUrl: '   ',
    });

    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: 'duties.vn.official.fta_excel',
    });
    expect(out).toBe('https://resolved.test/source.xlsx');
  });
});
