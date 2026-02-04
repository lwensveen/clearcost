import { describe, expect, it } from 'vitest';
import {
  deriveConfidenceFromStatus,
  deriveQuoteConfidenceParts,
  overallConfidenceFrom,
} from './confidence.js';

describe('quote confidence mapping', () => {
  it('maps lookup status to confidence correctly', () => {
    expect(deriveConfidenceFromStatus('ok')).toBe('authoritative');
    expect(deriveConfidenceFromStatus('no_match')).toBe('authoritative');
    expect(deriveConfidenceFromStatus('out_of_scope')).toBe('estimated');
    expect(deriveConfidenceFromStatus('no_dataset')).toBe('missing');
    expect(deriveConfidenceFromStatus('error')).toBe('missing');
  });

  it('falls back to missing for unknown status values', () => {
    expect(deriveConfidenceFromStatus('unexpected_status' as any)).toBe('missing');
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

  it('treats no_match components as authoritative and not missing', () => {
    const out = deriveQuoteConfidenceParts({
      statuses: {
        duty: 'no_match',
        vat: 'no_match',
        surcharges: 'no_match',
        freight: 'ok',
      },
      fxMissingRate: false,
      freightOverridden: false,
    });

    expect(out.componentConfidence).toEqual({
      duty: 'authoritative',
      vat: 'authoritative',
      surcharges: 'authoritative',
      freight: 'authoritative',
      fx: 'authoritative',
    });
    expect(out.missingComponents).toEqual([]);
    expect(out.overallConfidence).toBe('authoritative');
  });

  it('marks no_dataset/error and missing FX as missing components', () => {
    const out = deriveQuoteConfidenceParts({
      statuses: {
        duty: 'no_dataset',
        vat: 'error',
        surcharges: 'no_dataset',
        freight: 'no_dataset',
      },
      fxMissingRate: true,
      freightOverridden: false,
    });

    expect(out.componentConfidence).toEqual({
      duty: 'missing',
      vat: 'missing',
      surcharges: 'missing',
      freight: 'missing',
      fx: 'missing',
    });
    expect(out.missingComponents).toEqual(['duty', 'vat', 'surcharges', 'freight', 'fx']);
    expect(out.overallConfidence).toBe('missing');
  });

  it('treats freight override as estimated and not missing even when lookup is missing', () => {
    const out = deriveQuoteConfidenceParts({
      statuses: {
        duty: 'ok',
        vat: 'ok',
        surcharges: 'ok',
        freight: 'no_dataset',
      },
      fxMissingRate: false,
      freightOverridden: true,
    });

    expect(out.componentConfidence.freight).toBe('estimated');
    expect(out.missingComponents).toEqual([]);
    expect(out.overallConfidence).toBe('estimated');
  });
});
