import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  selectMock: vi.fn(),
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

import { fetchRate } from './fetch-rate.js';

function chainMock(result: unknown[]) {
  return () => ({
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: () => Promise.resolve(result),
        }),
      }),
    }),
  });
}

describe('fetchRate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns the numeric rate when a row is found', async () => {
    mocks.selectMock.mockImplementation(chainMock([{ rate: '1.08500' }]));

    const result = await fetchRate('EUR', 'USD');

    expect(result).toBe(1.085);
    expect(mocks.selectMock).toHaveBeenCalledOnce();
  });

  it('returns null when no row is found', async () => {
    mocks.selectMock.mockImplementation(chainMock([]));

    const result = await fetchRate('EUR', 'GBP');

    expect(result).toBeNull();
  });

  it('passes the on date for time-bounded lookups', async () => {
    const onDate = new Date('2025-06-01T00:00:00.000Z');
    const fromFn = vi.fn();
    const whereFn = vi.fn();
    const orderByFn = vi.fn();
    const limitFn = vi.fn().mockResolvedValue([{ rate: '0.85000' }]);

    mocks.selectMock.mockReturnValue({
      from: fromFn.mockReturnValue({
        where: whereFn.mockReturnValue({
          orderBy: orderByFn.mockReturnValue({
            limit: limitFn,
          }),
        }),
      }),
    });

    const result = await fetchRate('USD', 'EUR', onDate);

    expect(result).toBe(0.85);
    expect(mocks.selectMock).toHaveBeenCalledOnce();
  });

  it('returns null when the on date excludes all rows', async () => {
    mocks.selectMock.mockImplementation(chainMock([]));

    const result = await fetchRate('USD', 'JPY', new Date('2000-01-01'));

    expect(result).toBeNull();
  });

  it('coerces string rate to number correctly', async () => {
    mocks.selectMock.mockImplementation(chainMock([{ rate: '150.12345' }]));

    const result = await fetchRate('USD', 'JPY');

    expect(result).toBe(150.12345);
  });

  it('works without an on date (no date predicate)', async () => {
    const fromFn = vi.fn();
    const whereFn = vi.fn();
    const orderByFn = vi.fn();
    const limitFn = vi.fn().mockResolvedValue([{ rate: '1.00000' }]);

    mocks.selectMock.mockReturnValue({
      from: fromFn.mockReturnValue({
        where: whereFn.mockReturnValue({
          orderBy: orderByFn.mockReturnValue({
            limit: limitFn,
          }),
        }),
      }),
    });

    const result = await fetchRate('USD', 'USD');

    expect(result).toBe(1);
    expect(mocks.selectMock).toHaveBeenCalledOnce();
  });
});
