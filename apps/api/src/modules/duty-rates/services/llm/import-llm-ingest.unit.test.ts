import { describe, expect, it } from 'vitest';
import { importDutyRatesFromLLM } from './import-llm-ingest.js';

describe('importDutyRatesFromLLM', () => {
  it('fails fast on empty source rows', async () => {
    await expect(importDutyRatesFromLLM([])).rejects.toThrow(/source produced 0 rows/i);
  });
});
