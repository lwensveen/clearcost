import { describe, expect, it } from 'vitest';
import { batchUpsertSurchargesFromStream } from './batch-upsert.js';

describe('batchUpsertSurchargesFromStream', () => {
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
  });
});
