import { describe, expect, it } from 'vitest';
import { deriveConfidenceFromStatus, overallConfidenceFrom } from './confidence.js';

describe('quote confidence mapping', () => {
  it('maps lookup status to confidence correctly', () => {
    expect(deriveConfidenceFromStatus('ok')).toBe('authoritative');
    expect(deriveConfidenceFromStatus('no_match')).toBe('authoritative');
    expect(deriveConfidenceFromStatus('out_of_scope')).toBe('estimated');
    expect(deriveConfidenceFromStatus('no_dataset')).toBe('missing');
    expect(deriveConfidenceFromStatus('error')).toBe('missing');
  });

  it('computes overall confidence as worst-of', () => {
    expect(
      overallConfidenceFrom({
        duty: 'authoritative',
        vat: 'authoritative',
        surcharges: 'authoritative',
      })
    ).toBe('authoritative');

    expect(
      overallConfidenceFrom({
        duty: 'authoritative',
        vat: 'estimated',
        surcharges: 'authoritative',
      })
    ).toBe('estimated');

    expect(
      overallConfidenceFrom({
        duty: 'authoritative',
        vat: 'estimated',
        surcharges: 'missing',
      })
    ).toBe('missing');
  });
});
