import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insertMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock('@clearcost/db', async () => {
  const actual = await vi.importActual<typeof import('@clearcost/db')>('@clearcost/db');
  return {
    ...actual,
    db: {
      ...actual.db,
      insert: mocks.insertMock,
      transaction: mocks.transactionMock,
    },
  };
});

import { importSurcharges } from './import-surcharges.js';

describe('importSurcharges', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('fails fast when source rows normalize to zero valid records', async () => {
    await expect(importSurcharges([])).rejects.toThrow(/source produced 0 valid rows/i);
    expect(mocks.insertMock).not.toHaveBeenCalled();
  });

  it('fails fast when monetary surcharges omit currency', async () => {
    await expect(
      importSurcharges([
        {
          dest: 'US',
          surchargeCode: 'MPF',
          rateType: 'fixed',
          fixedAmt: '5',
        } as any,
      ])
    ).rejects.toThrow(/currency is required/i);
    expect(mocks.insertMock).not.toHaveBeenCalled();
  });

  it('fails fast when provided currency code is invalid', async () => {
    await expect(
      importSurcharges([
        {
          dest: 'US',
          surchargeCode: 'MPF',
          rateType: 'fixed',
          fixedAmt: '5',
          currency: 'US',
        } as any,
      ])
    ).rejects.toThrow(/invalid currency code/i);
    expect(mocks.insertMock).not.toHaveBeenCalled();
  });

  it('fails fast when rateType is ambiguous and cannot be inferred', async () => {
    await expect(
      importSurcharges([
        {
          dest: 'US',
          surchargeCode: 'OTHER',
          fixedAmt: '5',
          pctAmt: '0.05',
          currency: 'USD',
        } as any,
      ])
    ).rejects.toThrow(/ambiguous surcharge ratetype/i);
    expect(mocks.insertMock).not.toHaveBeenCalled();
  });

  it('tags rows with import source when source is not set on the row', async () => {
    const onConflictDoUpdateMock = vi
      .fn()
      .mockReturnValue({ returning: vi.fn().mockResolvedValue([]) });
    const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock });
    mocks.transactionMock.mockImplementation(async (fn) => {
      await fn({
        insert: vi.fn().mockReturnValue({ values: valuesMock }),
      });
    });

    await importSurcharges(
      [
        {
          dest: 'US',
          surchargeCode: 'MPF',
          rateType: 'ad_valorem',
          pctAmt: '0.01',
          currency: 'USD',
        } as any,
      ],
      { source: 'fallback' }
    );

    const [row] = valuesMock.mock.calls[0] ?? [];
    expect(row?.source).toBe('fallback');
  });

  it('prevents non-official source rows from overwriting official rows', async () => {
    const onConflictDoUpdateMock = vi
      .fn()
      .mockReturnValue({ returning: vi.fn().mockResolvedValue([]) });
    const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock });
    mocks.transactionMock.mockImplementation(async (fn) => {
      await fn({
        insert: vi.fn().mockReturnValue({ values: valuesMock }),
      });
    });

    await importSurcharges(
      [
        {
          dest: 'US',
          surchargeCode: 'MPF',
          rateType: 'ad_valorem',
          pctAmt: '0.01',
          currency: 'USD',
        } as any,
      ],
      { source: 'llm' }
    );

    const [conflictOpts] = onConflictDoUpdateMock.mock.calls[0] ?? [];
    expect(conflictOpts?.setWhere).toBeDefined();
  });
});
