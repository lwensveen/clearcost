import { describe, expect, it, vi } from 'vitest';

import { importVatRules } from './import-vat.js';

describe('importVatRules', () => {
  it('fails fast on empty source rows', async () => {
    await expect(importVatRules([])).rejects.toThrow(/source produced 0 rows/i);
  });
});
