import { describe, expect, it } from 'vitest';
import { importSurcharges } from './import-surcharges.js';

describe('importSurcharges', () => {
  it('fails fast when source rows normalize to zero valid records', async () => {
    await expect(importSurcharges([])).rejects.toThrow(/source produced 0 valid rows/i);
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
  });
});
