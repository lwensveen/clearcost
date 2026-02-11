import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insertMock: vi.fn(),
}));

vi.mock('@clearcost/db', async () => {
  const actual = await vi.importActual<typeof import('@clearcost/db')>('@clearcost/db');
  return {
    ...actual,
    db: {
      ...actual.db,
      insert: mocks.insertMock,
    },
  };
});

import { importDeMinimis } from './import-de-minimis.js';

describe('importDeMinimis', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('fails fast on empty source rows', async () => {
    await expect(importDeMinimis([])).rejects.toThrow(/source produced 0 rows/i);
    expect(mocks.insertMock).not.toHaveBeenCalled();
  });

  it('fails fast when de minimis basis is missing', async () => {
    await expect(
      importDeMinimis([
        {
          dest: 'US',
          deMinimisKind: 'DUTY',
          currency: 'USD',
          value: '800',
          effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
          effectiveTo: null,
        } as any,
      ])
    ).rejects.toThrow(/invalid deminimisbasis/i);

    expect(mocks.insertMock).not.toHaveBeenCalled();
  });

  it('fails fast when currency code is invalid', async () => {
    await expect(
      importDeMinimis([
        {
          dest: 'US',
          deMinimisKind: 'DUTY',
          deMinimisBasis: 'INTRINSIC',
          currency: 'US',
          value: '800',
          effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
          effectiveTo: null,
        },
      ])
    ).rejects.toThrow(/invalid currency code/i);

    expect(mocks.insertMock).not.toHaveBeenCalled();
  });
});
