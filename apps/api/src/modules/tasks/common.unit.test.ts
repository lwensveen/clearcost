import { describe, expect, it } from 'vitest';
import { assertNonEmptyImportRows } from './common.js';

describe('assertNonEmptyImportRows', () => {
  it('does not throw when at least one row exists', () => {
    expect(() =>
      assertNonEmptyImportRows({ length: 1 }, { job: 'duties:json', sourceUrl: 'https://x.test' })
    ).not.toThrow();
  });

  it('throws explicit error when source yields zero rows', () => {
    expect(() =>
      assertNonEmptyImportRows(
        { length: 0 },
        {
          job: 'duties:json',
          sourceUrl: 'https://x.test/duties.json',
          detail: 'parser mismatch',
        }
      )
    ).toThrow(
      '[duties:json] source produced 0 rows from https://x.test/duties.json (parser mismatch)'
    );
  });
});
