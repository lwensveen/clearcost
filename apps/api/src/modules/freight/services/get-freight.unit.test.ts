import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  selectMock: vi.fn(),
  freightLaneLookupCandidatesMock: vi.fn(),
}));

vi.mock('@clearcost/db', async () => {
  const actual = await vi.importActual<typeof import('@clearcost/db')>('@clearcost/db');
  return {
    ...actual,
    db: {
      ...actual.db,
      select: mocks.selectMock,
    },
  };
});

vi.mock('./lane-country-code.js', () => ({
  freightLaneLookupCandidates: mocks.freightLaneLookupCandidatesMock,
}));

import type { FreightLookupInput } from './get-freight.js';
import { getFreight, getFreightWithMeta } from './get-freight.js';

function makeOpts(overrides?: Partial<FreightLookupInput>): FreightLookupInput {
  return {
    origin: 'CN',
    dest: 'NL',
    freightMode: 'sea',
    freightUnit: 'kg',
    qty: 100,
    on: new Date('2025-06-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('getFreightWithMeta', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.freightLaneLookupCandidatesMock.mockReturnValue(['CHN', 'CN']);
  });

  it('returns error when origin candidates are empty', async () => {
    mocks.freightLaneLookupCandidatesMock
      .mockReturnValueOnce([]) // origin
      .mockReturnValueOnce(['NLD', 'NL']); // dest

    const result = await getFreightWithMeta(makeOpts());

    expect(result.value).toBeNull();
    expect(result.meta.status).toBe('error');
    expect(result.meta.note).toContain('invalid freight lane input');
  });

  it('returns error when dest candidates are empty', async () => {
    mocks.freightLaneLookupCandidatesMock
      .mockReturnValueOnce(['CHN', 'CN']) // origin
      .mockReturnValueOnce([]); // dest

    const result = await getFreightWithMeta(makeOpts());

    expect(result.value).toBeNull();
    expect(result.meta.status).toBe('error');
    expect(result.meta.note).toContain('invalid freight lane input');
  });

  it('returns no_dataset when no card and no coverage exists', async () => {
    mocks.freightLaneLookupCandidatesMock
      .mockReturnValueOnce(['CHN', 'CN'])
      .mockReturnValueOnce(['NLD', 'NL']);

    // First DB call: card lookup returns empty
    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    });

    // Second DB call: coverage check returns empty
    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    });

    const result = await getFreightWithMeta(makeOpts());

    expect(result.value).toBeNull();
    expect(result.meta.status).toBe('no_dataset');
  });

  it('returns no_match when no card found but coverage exists for the dest', async () => {
    const coverageDate = new Date('2025-01-01T00:00:00.000Z');

    mocks.freightLaneLookupCandidatesMock
      .mockReturnValueOnce(['CHN', 'CN'])
      .mockReturnValueOnce(['NLD', 'NL']);

    // First DB call: card lookup returns empty
    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    });

    // Second DB call: coverage check returns a row
    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([{ effectiveFrom: coverageDate }]),
          }),
        }),
      }),
    });

    const result = await getFreightWithMeta(makeOpts());

    expect(result.value).toBeNull();
    expect(result.meta.status).toBe('no_match');
    expect(result.meta.effectiveFrom).toEqual(coverageDate);
  });

  it('returns ok with calculated price when card and step are found', async () => {
    mocks.freightLaneLookupCandidatesMock
      .mockReturnValueOnce(['CHN', 'CN'])
      .mockReturnValueOnce(['NLD', 'NL']);

    // First DB call: card lookup
    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () =>
              Promise.resolve([
                {
                  id: 'card-1',
                  currency: 'USD',
                  minCharge: null,
                  priceRounding: null,
                  effectiveFrom: new Date('2025-01-01'),
                },
              ]),
          }),
        }),
      }),
    });

    // Second DB call: step lookup (qty <= uptoQty)
    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([{ uptoQty: 500, price: '2.50' }]),
          }),
        }),
      }),
    });

    const result = await getFreightWithMeta(makeOpts({ qty: 100 }));

    expect(result.value).toEqual({
      currency: 'USD',
      unit: 'kg',
      qty: 100,
      price: 250, // 2.50 * 100
    });
    expect(result.meta.status).toBe('ok');
  });

  it('applies minCharge when computed price is below minimum', async () => {
    mocks.freightLaneLookupCandidatesMock
      .mockReturnValueOnce(['CHN', 'CN'])
      .mockReturnValueOnce(['NLD', 'NL']);

    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () =>
              Promise.resolve([
                {
                  id: 'card-1',
                  currency: 'EUR',
                  minCharge: '50.00',
                  priceRounding: null,
                  effectiveFrom: new Date('2025-01-01'),
                },
              ]),
          }),
        }),
      }),
    });

    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([{ uptoQty: 500, price: '1.00' }]),
          }),
        }),
      }),
    });

    // price = 1.00 * 5 = 5.00, but minCharge = 50.00
    const result = await getFreightWithMeta(makeOpts({ qty: 5 }));

    expect(result.value!.price).toBe(50);
  });

  it('applies priceRounding', async () => {
    mocks.freightLaneLookupCandidatesMock
      .mockReturnValueOnce(['CHN', 'CN'])
      .mockReturnValueOnce(['NLD', 'NL']);

    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () =>
              Promise.resolve([
                {
                  id: 'card-1',
                  currency: 'USD',
                  minCharge: null,
                  priceRounding: '5.00',
                  effectiveFrom: new Date('2025-01-01'),
                },
              ]),
          }),
        }),
      }),
    });

    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([{ uptoQty: 500, price: '1.30' }]),
          }),
        }),
      }),
    });

    // price = 1.30 * 10 = 13.00, rounded to nearest 5 = 15
    const result = await getFreightWithMeta(makeOpts({ qty: 10 }));

    expect(result.value!.price).toBe(15);
  });

  it('falls back to highest step when qty exceeds all step ranges', async () => {
    mocks.freightLaneLookupCandidatesMock
      .mockReturnValueOnce(['CHN', 'CN'])
      .mockReturnValueOnce(['NLD', 'NL']);

    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () =>
              Promise.resolve([
                {
                  id: 'card-1',
                  currency: 'USD',
                  minCharge: null,
                  priceRounding: null,
                  effectiveFrom: new Date('2025-01-01'),
                },
              ]),
          }),
        }),
      }),
    });

    // First step query: no matching step (qty exceeds all uptoQty)
    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    });

    // Fallback step query: highest step
    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([{ uptoQty: 1000, price: '0.80' }]),
          }),
        }),
      }),
    });

    const result = await getFreightWithMeta(makeOpts({ qty: 5000 }));

    expect(result.value!.price).toBe(4000); // 0.80 * 5000
    expect(result.meta.status).toBe('ok');
  });

  it('returns no_dataset when card exists but has no steps', async () => {
    mocks.freightLaneLookupCandidatesMock
      .mockReturnValueOnce(['CHN', 'CN'])
      .mockReturnValueOnce(['NLD', 'NL']);

    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () =>
              Promise.resolve([
                {
                  id: 'card-1',
                  currency: 'USD',
                  minCharge: null,
                  priceRounding: null,
                  effectiveFrom: new Date('2025-01-01'),
                },
              ]),
          }),
        }),
      }),
    });

    // First step query: empty
    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    });

    // Fallback step query: also empty
    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    });

    const result = await getFreightWithMeta(makeOpts());

    expect(result.value).toBeNull();
    expect(result.meta.status).toBe('no_dataset');
  });

  it('catches unexpected errors and returns error meta', async () => {
    mocks.freightLaneLookupCandidatesMock
      .mockReturnValueOnce(['CHN', 'CN'])
      .mockReturnValueOnce(['NLD', 'NL']);

    mocks.selectMock.mockReturnValueOnce({
      from: () => {
        throw new Error('DB connection failed');
      },
    });

    const result = await getFreightWithMeta(makeOpts());

    expect(result.value).toBeNull();
    expect(result.meta.status).toBe('error');
    expect(result.meta.note).toBe('DB connection failed');
  });
});

describe('getFreight', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.freightLaneLookupCandidatesMock.mockReturnValue(['CHN', 'CN']);
  });

  it('returns just the value from getFreightWithMeta', async () => {
    mocks.freightLaneLookupCandidatesMock
      .mockReturnValueOnce(['CHN', 'CN'])
      .mockReturnValueOnce(['NLD', 'NL']);

    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () =>
              Promise.resolve([
                {
                  id: 'card-1',
                  currency: 'USD',
                  minCharge: null,
                  priceRounding: null,
                  effectiveFrom: new Date('2025-01-01'),
                },
              ]),
          }),
        }),
      }),
    });

    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([{ uptoQty: 500, price: '3.00' }]),
          }),
        }),
      }),
    });

    const result = await getFreight(makeOpts({ qty: 10 }));

    expect(result).toEqual({
      currency: 'USD',
      unit: 'kg',
      qty: 10,
      price: 30,
    });
  });

  it('returns null when no freight data is available', async () => {
    mocks.freightLaneLookupCandidatesMock
      .mockReturnValueOnce(['CHN', 'CN'])
      .mockReturnValueOnce(['NLD', 'NL']);

    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    });

    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    });

    const result = await getFreight(makeOpts());

    expect(result).toBeNull();
  });
});
