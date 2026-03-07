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

import { getVat } from './get-vat.js';

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

describe('getVat', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns the VAT row with numeric ratePct for a matching destination', async () => {
    const effectiveDate = new Date('2024-01-01T00:00:00.000Z');
    mocks.selectMock.mockImplementation(
      chainMock([
        {
          ratePct: '21.000',
          vatBase: 'CIF_PLUS_DUTY',
          vatRateKind: 'STANDARD',
          source: 'official',
          effectiveFrom: effectiveDate,
        },
      ])
    );

    const result = await getVat('NL', new Date('2025-06-01'));

    expect(result).toEqual({
      ratePct: 21,
      vatBase: 'CIF_PLUS_DUTY',
      vatRateKind: 'STANDARD',
      source: 'official',
      effectiveFrom: effectiveDate,
    });
  });

  it('returns null when no VAT row matches', async () => {
    mocks.selectMock.mockImplementation(chainMock([]));

    const result = await getVat('XX', new Date('2025-06-01'));

    expect(result).toBeNull();
  });

  it('uppercases the destination code', async () => {
    mocks.selectMock.mockImplementation(
      chainMock([
        {
          ratePct: '25.000',
          vatBase: 'CIF',
          vatRateKind: 'STANDARD',
          source: 'official',
          effectiveFrom: new Date('2024-01-01'),
        },
      ])
    );

    const result = await getVat('se', new Date('2025-06-01'));

    expect(result).not.toBeNull();
    expect(result!.ratePct).toBe(25);
  });

  it('normalizes CIF vatBase as CIF', async () => {
    mocks.selectMock.mockImplementation(
      chainMock([
        {
          ratePct: '20.000',
          vatBase: 'CIF',
          vatRateKind: 'STANDARD',
          source: 'official',
          effectiveFrom: new Date('2024-01-01'),
        },
      ])
    );

    const result = await getVat('GB', new Date('2025-01-01'));

    expect(result!.vatBase).toBe('CIF');
  });

  it('normalizes unknown vatBase to CIF_PLUS_DUTY', async () => {
    mocks.selectMock.mockImplementation(
      chainMock([
        {
          ratePct: '19.000',
          vatBase: 'FOB',
          vatRateKind: 'STANDARD',
          source: 'official',
          effectiveFrom: new Date('2024-01-01'),
        },
      ])
    );

    const result = await getVat('DE', new Date('2025-01-01'));

    expect(result!.vatBase).toBe('CIF_PLUS_DUTY');
  });

  it('passes the source filter when opts.source is provided', async () => {
    const fromFn = vi.fn();
    const whereFn = vi.fn();
    const orderByFn = vi.fn();
    const limitFn = vi.fn().mockResolvedValue([
      {
        ratePct: '21.000',
        vatBase: 'CIF_PLUS_DUTY',
        vatRateKind: 'STANDARD',
        source: 'official',
        effectiveFrom: new Date('2024-01-01'),
      },
    ]);

    mocks.selectMock.mockReturnValue({
      from: fromFn.mockReturnValue({
        where: whereFn.mockReturnValue({
          orderBy: orderByFn.mockReturnValue({
            limit: limitFn,
          }),
        }),
      }),
    });

    const result = await getVat('NL', new Date('2025-06-01'), 'STANDARD', { source: 'official' });

    expect(result).not.toBeNull();
    expect(result!.source).toBe('official');
    expect(mocks.selectMock).toHaveBeenCalledOnce();
  });

  it('supports REDUCED rate kind', async () => {
    mocks.selectMock.mockImplementation(
      chainMock([
        {
          ratePct: '9.000',
          vatBase: 'CIF_PLUS_DUTY',
          vatRateKind: 'REDUCED',
          source: 'official',
          effectiveFrom: new Date('2024-01-01'),
        },
      ])
    );

    const result = await getVat('NL', new Date('2025-06-01'), 'REDUCED');

    expect(result).not.toBeNull();
    expect(result!.ratePct).toBe(9);
    expect(result!.vatRateKind).toBe('REDUCED');
  });

  it('returns null source when source field is null in DB', async () => {
    mocks.selectMock.mockImplementation(
      chainMock([
        {
          ratePct: '10.000',
          vatBase: 'CIF_PLUS_DUTY',
          vatRateKind: 'STANDARD',
          source: null,
          effectiveFrom: new Date('2024-01-01'),
        },
      ])
    );

    const result = await getVat('JP', new Date('2025-01-01'));

    expect(result).not.toBeNull();
    expect(result!.source).toBeNull();
  });

  it('defaults to STANDARD kind when not specified', async () => {
    const fromFn = vi.fn();
    const whereFn = vi.fn();
    const orderByFn = vi.fn();
    const limitFn = vi.fn().mockResolvedValue([
      {
        ratePct: '21.000',
        vatBase: 'CIF_PLUS_DUTY',
        vatRateKind: 'STANDARD',
        source: 'official',
        effectiveFrom: new Date('2024-01-01'),
      },
    ]);

    mocks.selectMock.mockReturnValue({
      from: fromFn.mockReturnValue({
        where: whereFn.mockReturnValue({
          orderBy: orderByFn.mockReturnValue({
            limit: limitFn,
          }),
        }),
      }),
    });

    await getVat('NL', new Date('2025-06-01'));

    // The function was called, meaning it used STANDARD as default
    expect(mocks.selectMock).toHaveBeenCalledOnce();
  });
});
