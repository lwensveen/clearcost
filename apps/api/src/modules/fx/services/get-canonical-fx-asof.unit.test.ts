import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { getCanonicalFxAsOf } from './get-canonical-fx-asof.js';

describe('getCanonicalFxAsOf', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the ECB date when ECB rows exist', async () => {
    const ecbDate = new Date('2025-06-01T00:00:00.000Z');

    // First call: ECB query returns a row
    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([{ fxAsOf: ecbDate }]),
          }),
        }),
      }),
    });

    const result = await getCanonicalFxAsOf();

    expect(result).toEqual(ecbDate);
    expect(mocks.selectMock).toHaveBeenCalledOnce();
  });

  it('falls back to any provider when no ECB rows exist', async () => {
    const anyDate = new Date('2025-05-31T00:00:00.000Z');

    // First call: ECB query returns empty
    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    });

    // Second call: any-provider query returns a row
    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        orderBy: () => ({
          limit: () => Promise.resolve([{ fxAsOf: anyDate }]),
        }),
      }),
    });

    const result = await getCanonicalFxAsOf();

    expect(result).toEqual(anyDate);
    expect(mocks.selectMock).toHaveBeenCalledTimes(2);
  });

  it('returns today UTC midnight when the table is completely empty', async () => {
    vi.setSystemTime(new Date('2025-07-15T14:30:00.000Z'));

    // First call: ECB query returns empty
    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    });

    // Second call: any-provider query also returns empty
    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        orderBy: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    });

    const result = await getCanonicalFxAsOf();

    expect(result).toEqual(new Date('2025-07-15T00:00:00.000Z'));
    expect(mocks.selectMock).toHaveBeenCalledTimes(2);
  });

  it('returns ECB date even when the fxAsOf is null for the fallback row', async () => {
    const ecbDate = new Date('2025-01-10T00:00:00.000Z');

    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([{ fxAsOf: ecbDate }]),
          }),
        }),
      }),
    });

    const result = await getCanonicalFxAsOf();

    expect(result).toEqual(ecbDate);
  });

  it('skips ECB with null fxAsOf and falls back to any provider', async () => {
    const anyDate = new Date('2025-03-20T00:00:00.000Z');

    // First call: ECB query returns a row with null fxAsOf
    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([{ fxAsOf: null }]),
          }),
        }),
      }),
    });

    // Second call: any-provider query returns a row
    mocks.selectMock.mockReturnValueOnce({
      from: () => ({
        orderBy: () => ({
          limit: () => Promise.resolve([{ fxAsOf: anyDate }]),
        }),
      }),
    });

    const result = await getCanonicalFxAsOf();

    expect(result).toEqual(anyDate);
    expect(mocks.selectMock).toHaveBeenCalledTimes(2);
  });
});
