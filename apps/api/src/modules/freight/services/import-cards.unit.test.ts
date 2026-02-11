import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  selectDistinctMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock('@clearcost/db', async () => {
  const actual = await vi.importActual<typeof import('@clearcost/db')>('@clearcost/db');
  return {
    ...actual,
    db: {
      ...actual.db,
      selectDistinct: mocks.selectDistinctMock,
      transaction: mocks.transactionMock,
    },
  };
});

import { importFreightCards } from './import-cards.js';

const baseCard = {
  origin: 'CN',
  dest: 'DE',
  freightMode: 'air' as const,
  freightUnit: 'kg' as const,
  currency: 'USD',
  effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
  steps: [{ uptoQty: 10, pricePerUnit: 2.5 }],
};

function mockDistinctRows(rows: unknown[]) {
  mocks.selectDistinctMock.mockImplementationOnce(() => ({
    from: async () => rows,
  }));
}

describe('importFreightCards', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('fails clearly when a lane country code cannot be normalized to ISO3', async () => {
    await expect(
      importFreightCards([
        {
          ...baseCard,
          origin: 'ZZ',
        },
      ])
    ).rejects.toMatchObject({
      code: 'FREIGHT_LANE_INVALID_COUNTRY',
      field: 'origin',
    });

    expect(mocks.selectDistinctMock).not.toHaveBeenCalled();
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it('fails clearly when a freight card currency code is invalid', async () => {
    await expect(
      importFreightCards([
        {
          ...baseCard,
          currency: 'US1',
        },
      ])
    ).rejects.toThrow(/ISO-4217 currency code/i);

    expect(mocks.selectDistinctMock).not.toHaveBeenCalled();
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it('fails clearly when a freight card currency is missing', async () => {
    await expect(
      importFreightCards([
        {
          ...baseCard,
          currency: undefined,
        } as unknown as typeof baseCard,
      ])
    ).rejects.toThrow(/currency/i);

    expect(mocks.selectDistinctMock).not.toHaveBeenCalled();
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it('fails when strict coverage guardrails detect a major lane coverage drop', async () => {
    mockDistinctRows([
      { origin: 'CHN', dest: 'DEU', freightMode: 'air', freightUnit: 'kg' },
      { origin: 'CHN', dest: 'FRA', freightMode: 'air', freightUnit: 'kg' },
      { origin: 'USA', dest: 'DEU', freightMode: 'air', freightUnit: 'kg' },
      { origin: 'USA', dest: 'FRA', freightMode: 'air', freightUnit: 'kg' },
    ]);
    mockDistinctRows([{ dest: 'DEU' }, { dest: 'FRA' }]);

    await expect(
      importFreightCards([baseCard], {
        enforceCoverageGuardrails: true,
      })
    ).rejects.toThrow(/incoming lane coverage dropped too far/i);

    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it('rejects invalid guardrail retention values', async () => {
    await expect(
      importFreightCards([baseCard], {
        enforceCoverageGuardrails: true,
        minCoverageRetention: 1.2,
      })
    ).rejects.toThrow(/Invalid freight import minCoverageRetention/);

    expect(mocks.selectDistinctMock).not.toHaveBeenCalled();
  });
});
