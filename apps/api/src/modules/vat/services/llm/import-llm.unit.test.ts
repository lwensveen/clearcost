import { describe, expect, it } from 'vitest';
import { importVatFromLLM } from './import-llm.js';

describe('importVatFromLLM', () => {
  it('fails fast on empty source rows', async () => {
    await expect(importVatFromLLM([])).rejects.toThrow(/source produced 0 rows/i);
  });
});
