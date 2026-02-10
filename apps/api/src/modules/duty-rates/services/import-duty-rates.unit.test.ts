import { describe, expect, it } from 'vitest';
import { importDutyRates } from './import-duty-rates.js';

describe('importDutyRates', () => {
  it('fails fast on empty source rows', async () => {
    await expect(importDutyRates([])).rejects.toThrow(/source produced 0 rows/i);
  });
});
