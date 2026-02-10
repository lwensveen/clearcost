import { describe, expect, it } from 'vitest';
import { importSurcharges } from './import-surcharges.js';

describe('importSurcharges', () => {
  it('fails fast when source rows normalize to zero valid records', async () => {
    await expect(importSurcharges([])).rejects.toThrow(/source produced 0 valid rows/i);
  });
});
