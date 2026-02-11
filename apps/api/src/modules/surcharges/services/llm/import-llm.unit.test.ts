import { describe, expect, it } from 'vitest';
import { importSurchargesFromLLM } from './import-llm.js';

describe('importSurchargesFromLLM', () => {
  it('fails fast on empty source rows', async () => {
    await expect(importSurchargesFromLLM([])).rejects.toThrow(/source produced 0 rows/i);
  });

  it('fails fast when monetary rows omit currency', async () => {
    await expect(
      importSurchargesFromLLM([
        {
          country_code: 'US',
          surcharge_code: 'MPF',
          rate_type: 'fixed',
          fixed_amount: 10,
          apply_level: 'entry',
          value_basis: 'customs',
          transport_mode: 'ALL',
          effective_from: '2025-01-01',
          source_url: 'https://www.cbp.gov',
        } as any,
      ])
    ).rejects.toThrow(/currency is required/i);
  });

  it('fails fast when provided currency code is invalid', async () => {
    await expect(
      importSurchargesFromLLM([
        {
          country_code: 'US',
          surcharge_code: 'MPF',
          rate_type: 'fixed',
          fixed_amount: 10,
          currency: 'US',
          apply_level: 'entry',
          value_basis: 'customs',
          transport_mode: 'ALL',
          effective_from: '2025-01-01',
          source_url: 'https://www.cbp.gov',
        } as any,
      ])
    ).rejects.toThrow(/invalid currency code/i);
  });
});
