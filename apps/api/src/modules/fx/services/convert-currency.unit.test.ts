import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchRateMock: vi.fn(),
}));

vi.mock('./fetch-rate.js', () => ({
  fetchRate: mocks.fetchRateMock,
}));

import { convertCurrency, convertCurrencyWithMeta } from './convert-currency.js';

describe('convertCurrency', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns explicit missing-rate metadata when strict is disabled', async () => {
    mocks.fetchRateMock.mockResolvedValue(null);

    const out = await convertCurrencyWithMeta(100, 'USD', 'NOK', {
      on: new Date('2025-01-01T00:00:00.000Z'),
      strict: false,
    });

    expect(out.amount).toBe(100);
    expect(out.meta.missingRate).toBe(true);
    expect(out.meta.error).toContain('USD->NOK');
  });

  it('throws when strict conversion has no available rate', async () => {
    mocks.fetchRateMock.mockResolvedValue(null);

    await expect(
      convertCurrency(100, 'USD', 'NOK', {
        on: new Date('2025-01-01T00:00:00.000Z'),
        strict: true,
      })
    ).rejects.toThrow('FX rate unavailable for USD->NOK on 2025-01-01');
  });
});
