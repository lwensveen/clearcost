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

import { batchUpsertSurchargesFromStream } from './batch-upsert.js';

describe('batchUpsertSurchargesFromStream', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('fails fast when monetary rows omit currency', async () => {
    await expect(
      batchUpsertSurchargesFromStream([
        {
          dest: 'US',
          surchargeCode: 'MPF',
          rateType: 'fixed',
          fixedAmt: 5,
        } as any,
      ])
    ).rejects.toThrow(/currency is required/i);
    expect(mocks.insertMock).not.toHaveBeenCalled();
  });

  it('fails fast when provided currency code is invalid', async () => {
    await expect(
      batchUpsertSurchargesFromStream([
        {
          dest: 'US',
          surchargeCode: 'MPF',
          rateType: 'fixed',
          fixedAmt: 5,
          currency: 'US',
        } as any,
      ])
    ).rejects.toThrow(/invalid currency code/i);
    expect(mocks.insertMock).not.toHaveBeenCalled();
  });

  it('fails fast when rateType is ambiguous and cannot be inferred', async () => {
    await expect(
      batchUpsertSurchargesFromStream([
        {
          dest: 'US',
          surchargeCode: 'OTHER',
          fixedAmt: 5,
          pctAmt: 0.05,
          currency: 'USD',
        } as any,
      ])
    ).rejects.toThrow(/ambiguous surcharge ratetype/i);
    expect(mocks.insertMock).not.toHaveBeenCalled();
  });

  it('defaults inserted rows to official source', async () => {
    const returningMock = vi.fn().mockResolvedValue([]);
    const onConflictDoUpdateMock = vi.fn().mockReturnValue({ returning: returningMock });
    const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock });
    mocks.insertMock.mockReturnValue({ values: valuesMock });

    await batchUpsertSurchargesFromStream([
      {
        dest: 'US',
        surchargeCode: 'MPF',
        rateType: 'ad_valorem',
        pctAmt: '0.01',
        currency: 'USD',
      } as any,
    ]);

    const [rows] = valuesMock.mock.calls[0] ?? [];
    expect(rows?.[0]?.source).toBe('official');
    const [conflictOpts] = onConflictDoUpdateMock.mock.calls[0] ?? [];
    expect(conflictOpts?.setWhere).toBeDefined();
  });

  it('keeps provided non-official source on inserted rows', async () => {
    const returningMock = vi.fn().mockResolvedValue([]);
    const onConflictDoUpdateMock = vi.fn().mockReturnValue({ returning: returningMock });
    const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock });
    mocks.insertMock.mockReturnValue({ values: valuesMock });

    await batchUpsertSurchargesFromStream(
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

    const [rows] = valuesMock.mock.calls[0] ?? [];
    expect(rows?.[0]?.source).toBe('llm');
  });
});
