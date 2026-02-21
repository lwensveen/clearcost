import { afterEach, describe, expect, it } from 'vitest';
import { dutiesWits } from './duties-wits.js';

const ORIGINAL_ENABLE_WITS_IMPORTS = process.env.ENABLE_WITS_IMPORTS;
const ORIGINAL_ENABLE_WITS_BACKFILL = process.env.ENABLE_WITS_BACKFILL;

afterEach(() => {
  if (ORIGINAL_ENABLE_WITS_IMPORTS === undefined) delete process.env.ENABLE_WITS_IMPORTS;
  else process.env.ENABLE_WITS_IMPORTS = ORIGINAL_ENABLE_WITS_IMPORTS;

  if (ORIGINAL_ENABLE_WITS_BACKFILL === undefined) delete process.env.ENABLE_WITS_BACKFILL;
  else process.env.ENABLE_WITS_BACKFILL = ORIGINAL_ENABLE_WITS_BACKFILL;
});

describe('duties-wits command gate', () => {
  it('fails fast when wits imports are disabled', async () => {
    delete process.env.ENABLE_WITS_IMPORTS;
    delete process.env.ENABLE_WITS_BACKFILL;

    await expect(dutiesWits([])).rejects.toThrow('WITS imports are disabled');
  });
});
