import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findManifestMock: vi.fn(),
  selectMock: vi.fn(),
  transactionMock: vi.fn(),
  quoteLandedCostMock: vi.fn(),
  getCurrencyForCountryMock: vi.fn(),
}));

vi.mock('@clearcost/db', async () => {
  const actual = await vi.importActual<typeof import('@clearcost/db')>('@clearcost/db');
  return {
    ...actual,
    db: {
      query: {
        manifestsTable: {
          findFirst: mocks.findManifestMock,
        },
      },
      select: mocks.selectMock,
      transaction: mocks.transactionMock,
    },
  };
});

vi.mock('@clearcost/types', async () => {
  const actual = await vi.importActual<typeof import('@clearcost/types')>('@clearcost/types');
  return {
    ...actual,
    getCurrencyForCountry: mocks.getCurrencyForCountryMock,
  };
});

vi.mock('../../quotes/services/quote-landed-cost.js', () => ({
  quoteLandedCost: mocks.quoteLandedCostMock,
}));

import { computePool } from './compute-pool.js';

describe('computePool', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.findManifestMock.mockResolvedValue({
      id: 'manifest-1',
      ownerId: 'owner-1',
      origin: 'CN',
      dest: 'DE',
      shippingMode: 'air',
      fixedFreightTotal: '30',
    });

    mocks.selectMock
      .mockImplementationOnce(() => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }))
      .mockImplementationOnce(() => ({
        from: () => ({
          where: async () => [
            {
              id: 'item-1',
              itemValueAmount: '100',
              itemValueCurrency: 'USD',
              dimsCm: { l: 10, w: 10, h: 10 },
              weightKg: '2',
              quantity: '4',
              liters: '1.5',
              categoryKey: 'apparel',
              hs6: '123456',
            },
          ],
        }),
      }));

    mocks.getCurrencyForCountryMock.mockReturnValue('EUR');

    mocks.quoteLandedCostMock.mockResolvedValue({
      quote: {
        hs6: '123456',
        chargeableKg: 2,
        components: {
          CIF: 130,
          duty: 5,
          vat: 20,
          fees: 3,
        },
        total: 158,
        guaranteedMax: 161.16,
      },
    });
  });

  it('forwards optional quantity and liters item context into quote compute', async () => {
    const out = await computePool('manifest-1', { allocation: 'weight', dryRun: true });

    expect(mocks.quoteLandedCostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'CN',
        dest: 'DE',
        mode: 'air',
        weightKg: 2,
        quantity: 4,
        liters: 1.5,
      }),
      expect.objectContaining({
        freightInDestOverride: 30,
        fxAsOf: expect.any(Date),
      })
    );

    expect(out.ok).toBe(true);
    expect(out.items?.[0]?.components.fees).toBe(3);
  });
});
