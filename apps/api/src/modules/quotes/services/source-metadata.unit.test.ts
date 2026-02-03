import { describe, expect, it } from 'vitest';
import { toQuoteSourceMetadata } from './source-metadata.js';

describe('toQuoteSourceMetadata', () => {
  it('keeps provider and asOf keys for backward compatibility', () => {
    const out = toQuoteSourceMetadata({
      dataset: 'official',
      effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
    });

    expect(out).toEqual({
      provider: null,
      dataset: 'official',
      asOf: null,
      effectiveFrom: '2025-01-01T00:00:00.000Z',
    });
  });

  it('defaults unknown source fields to nulls', () => {
    expect(toQuoteSourceMetadata(undefined)).toEqual({
      provider: null,
      dataset: null,
      asOf: null,
      effectiveFrom: null,
    });
  });
});
