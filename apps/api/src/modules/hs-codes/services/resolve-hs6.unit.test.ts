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

import { resolveHs6 } from './resolve-hs6.js';

function chainMock(result: unknown[]) {
  return () => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(result),
      }),
    }),
  });
}

describe('resolveHs6', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns the explicit hs6 when provided', async () => {
    const result = await resolveHs6('electronics', '854231');

    expect(result).toBe('854231');
    expect(mocks.selectMock).not.toHaveBeenCalled();
  });

  it('looks up default HS6 from DB when hs6 is not provided', async () => {
    mocks.selectMock.mockImplementation(chainMock([{ defaultHs6: '610910' }]));

    const result = await resolveHs6('t-shirts');

    expect(result).toBe('610910');
    expect(mocks.selectMock).toHaveBeenCalledOnce();
  });

  it('throws "Unknown category" when category is not found', async () => {
    mocks.selectMock.mockImplementation(chainMock([]));

    await expect(resolveHs6('nonexistent-category')).rejects.toThrow('Unknown category');
  });

  it('bypasses DB lookup when hs6 is an empty string (falsy)', async () => {
    mocks.selectMock.mockImplementation(chainMock([{ defaultHs6: '610910' }]));

    // Empty string is falsy, so it should fall through to DB lookup
    const result = await resolveHs6('t-shirts', '');

    expect(result).toBe('610910');
    expect(mocks.selectMock).toHaveBeenCalledOnce();
  });

  it('returns undefined hs6 directly when explicitly provided as undefined', async () => {
    mocks.selectMock.mockImplementation(chainMock([{ defaultHs6: '610910' }]));

    const result = await resolveHs6('t-shirts', undefined);

    expect(result).toBe('610910');
    expect(mocks.selectMock).toHaveBeenCalledOnce();
  });

  it('returns the hs6 as-is without DB lookup even for unusual codes', async () => {
    const result = await resolveHs6('electronics', '999999');

    expect(result).toBe('999999');
    expect(mocks.selectMock).not.toHaveBeenCalled();
  });
});
