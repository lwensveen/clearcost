import { describe, expect, it } from 'vitest';
import { resolveVatDatasetProvenance } from './get-vat-for-hs6.js';

describe('resolveVatDatasetProvenance', () => {
  it('returns null when no provenance columns are present', () => {
    expect(
      resolveVatDatasetProvenance({ effectiveFrom: new Date('2025-01-01T00:00:00.000Z') })
    ).toBe(null);
    expect(resolveVatDatasetProvenance()).toBeNull();
  });

  it('ignores internal resolver labels', () => {
    expect(resolveVatDatasetProvenance({ source: 'default' })).toBeNull();
    expect(resolveVatDatasetProvenance({ dataset: 'override-rate' })).toBeNull();
    expect(resolveVatDatasetProvenance({ source: 'override-kind' })).toBeNull();
  });

  it('returns dataset/source when real provenance is present', () => {
    expect(resolveVatDatasetProvenance({ dataset: 'official-vat-feed' })).toBe('official-vat-feed');
    expect(resolveVatDatasetProvenance({ source: 'manual' })).toBe('manual');
  });
});
