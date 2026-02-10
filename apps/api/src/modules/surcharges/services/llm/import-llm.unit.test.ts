import { describe, expect, it } from 'vitest';
import { importSurchargesFromLLM } from './import-llm.js';

describe('importSurchargesFromLLM', () => {
  it('fails fast on empty source rows', async () => {
    await expect(importSurchargesFromLLM([])).rejects.toThrow(/source produced 0 rows/i);
  });
});
