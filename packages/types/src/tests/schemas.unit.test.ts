import { describe, it, expect } from 'vitest';
import {
  ErrorResponseSchema,
  BillingCheckoutBodySchema,
  BillingCheckoutResponseSchema,
  BillingPlanResponseSchema,
  BillingEntitlementsResponseSchema,
  BillingComputeUsageResponseSchema,
  QuoteInputSchema,
  QuoteResponseSchema,
  QuoteRecentRowSchema,
  QuoteStatsResponseSchema,
  ClassifyInputSchema,
  ClassifyResponseSchema,
} from '../schemas/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse, serialize to JSON, then re-parse -- confirms round-trip stability. */
function roundTrip<T>(schema: { parse: (v: unknown) => T }, data: unknown): T {
  const first = schema.parse(data);
  const json = JSON.parse(JSON.stringify(first));
  return schema.parse(json);
}

// ---------------------------------------------------------------------------
// ErrorResponseSchema
// ---------------------------------------------------------------------------

describe('ErrorResponseSchema', () => {
  const valid = {
    error: { code: 'NOT_FOUND', message: 'Resource not found' },
  };

  it('accepts a valid error envelope', () => {
    const result = ErrorResponseSchema.parse(valid);
    expect(result.error.code).toBe('NOT_FOUND');
    expect(result.error.message).toBe('Resource not found');
  });

  it('accepts an error envelope with optional details', () => {
    const withDetails = {
      error: { code: 'VALIDATION', message: 'Bad input', details: { field: 'origin' } },
    };
    const result = ErrorResponseSchema.parse(withDetails);
    expect(result.error.details).toEqual({ field: 'origin' });
  });

  it('rejects when error.code is missing', () => {
    expect(() => ErrorResponseSchema.parse({ error: { message: 'oops' } })).toThrow();
  });

  it('rejects when error.message is empty', () => {
    expect(() => ErrorResponseSchema.parse({ error: { code: 'X', message: '' } })).toThrow();
  });

  it('rejects a completely empty object', () => {
    expect(() => ErrorResponseSchema.parse({})).toThrow();
  });

  it('round-trips through JSON', () => {
    const result = roundTrip(ErrorResponseSchema, valid);
    expect(result).toEqual(valid);
  });
});

// ---------------------------------------------------------------------------
// BillingCheckoutBodySchema
// ---------------------------------------------------------------------------

describe('BillingCheckoutBodySchema', () => {
  it('accepts valid plan values', () => {
    for (const plan of ['starter', 'growth', 'scale'] as const) {
      const result = BillingCheckoutBodySchema.parse({ plan });
      expect(result.plan).toBe(plan);
    }
  });

  it('accepts an optional returnUrl', () => {
    const result = BillingCheckoutBodySchema.parse({
      plan: 'growth',
      returnUrl: 'https://example.com/callback',
    });
    expect(result.returnUrl).toBe('https://example.com/callback');
  });

  it('rejects an invalid plan value', () => {
    expect(() => BillingCheckoutBodySchema.parse({ plan: 'enterprise' })).toThrow();
  });

  it('rejects an invalid returnUrl', () => {
    expect(() =>
      BillingCheckoutBodySchema.parse({ plan: 'starter', returnUrl: 'not-a-url' })
    ).toThrow();
  });

  it('rejects missing plan', () => {
    expect(() => BillingCheckoutBodySchema.parse({})).toThrow();
  });

  it('round-trips through JSON', () => {
    const data = { plan: 'scale', returnUrl: 'https://example.com' };
    const result = roundTrip(BillingCheckoutBodySchema, data);
    expect(result).toEqual(data);
  });
});

// ---------------------------------------------------------------------------
// BillingCheckoutResponseSchema
// ---------------------------------------------------------------------------

describe('BillingCheckoutResponseSchema', () => {
  it('accepts a valid checkout URL', () => {
    const result = BillingCheckoutResponseSchema.parse({
      url: 'https://checkout.stripe.com/session/abc',
    });
    expect(result.url).toBe('https://checkout.stripe.com/session/abc');
  });

  it('rejects a non-URL string', () => {
    expect(() => BillingCheckoutResponseSchema.parse({ url: 'bad' })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// BillingPlanResponseSchema
// ---------------------------------------------------------------------------

describe('BillingPlanResponseSchema', () => {
  const valid = {
    plan: 'growth',
    status: 'active',
    priceId: 'price_123',
    currentPeriodEnd: new Date('2026-04-01T00:00:00Z'),
  };

  it('accepts a full plan response', () => {
    const result = BillingPlanResponseSchema.parse(valid);
    expect(result.plan).toBe('growth');
    expect(result.status).toBe('active');
  });

  it('accepts nullable status', () => {
    const result = BillingPlanResponseSchema.parse({ plan: 'free', status: null });
    expect(result.status).toBeNull();
  });

  it('accepts nullable/optional priceId and currentPeriodEnd', () => {
    const result = BillingPlanResponseSchema.parse({
      plan: 'free',
      status: null,
      priceId: null,
      currentPeriodEnd: null,
    });
    expect(result.priceId).toBeNull();
    expect(result.currentPeriodEnd).toBeNull();
  });

  it('rejects missing plan', () => {
    expect(() => BillingPlanResponseSchema.parse({ status: 'active' })).toThrow();
  });

  it('round-trips through JSON (date serializes to string)', () => {
    // After JSON round-trip the Date becomes a string, but schema re-parses it.
    // BillingPlanResponseSchema uses z.date(), so JSON stringify -> string is NOT
    // re-parseable by z.date() without coerce. We verify parse -> JSON -> the
    // stringified value is consistent.
    const first = BillingPlanResponseSchema.parse(valid);
    const json = JSON.parse(JSON.stringify(first));
    // json.currentPeriodEnd is now an ISO string, not a Date, so re-parse with
    // date re-constructed
    if (json.currentPeriodEnd) {
      json.currentPeriodEnd = new Date(json.currentPeriodEnd);
    }
    const second = BillingPlanResponseSchema.parse(json);
    expect(second.plan).toBe(first.plan);
    expect(second.status).toBe(first.status);
  });
});

// ---------------------------------------------------------------------------
// BillingEntitlementsResponseSchema
// ---------------------------------------------------------------------------

describe('BillingEntitlementsResponseSchema', () => {
  const valid = { plan: 'growth', maxManifests: 50, maxItemsPerManifest: 500 };

  it('accepts valid entitlements', () => {
    const result = BillingEntitlementsResponseSchema.parse(valid);
    expect(result.maxManifests).toBe(50);
  });

  it('rejects missing maxManifests', () => {
    expect(() =>
      BillingEntitlementsResponseSchema.parse({ plan: 'growth', maxItemsPerManifest: 500 })
    ).toThrow();
  });

  it('round-trips through JSON', () => {
    expect(roundTrip(BillingEntitlementsResponseSchema, valid)).toEqual(valid);
  });
});

// ---------------------------------------------------------------------------
// BillingComputeUsageResponseSchema
// ---------------------------------------------------------------------------

describe('BillingComputeUsageResponseSchema', () => {
  const valid = { allowed: true, plan: 'growth', limit: 1000, used: 42 };

  it('accepts valid compute usage', () => {
    const result = BillingComputeUsageResponseSchema.parse(valid);
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(42);
  });

  it('rejects non-integer limit', () => {
    expect(() => BillingComputeUsageResponseSchema.parse({ ...valid, limit: 10.5 })).toThrow();
  });

  it('round-trips through JSON', () => {
    expect(roundTrip(BillingComputeUsageResponseSchema, valid)).toEqual(valid);
  });
});

// ---------------------------------------------------------------------------
// QuoteInputSchema
// ---------------------------------------------------------------------------

describe('QuoteInputSchema', () => {
  const valid = {
    origin: 'US',
    dest: 'NL',
    itemValue: { amount: 100, currency: 'USD' },
    dimsCm: { l: 30, w: 20, h: 10 },
    weightKg: 2.5,
    categoryKey: 'electronics',
    mode: 'air' as const,
  };

  it('accepts a minimal valid quote input', () => {
    const result = QuoteInputSchema.parse(valid);
    expect(result.origin).toBe('US');
    expect(result.dest).toBe('NL');
    expect(result.mode).toBe('air');
  });

  it('accepts optional fields (hs6, quantity, liters)', () => {
    const result = QuoteInputSchema.parse({
      ...valid,
      hs6: '854231',
      quantity: 10,
      liters: 0.5,
    });
    expect(result.hs6).toBe('854231');
    expect(result.quantity).toBe(10);
    expect(result.liters).toBe(0.5);
  });

  it('rejects origin that is not exactly 2 characters', () => {
    expect(() => QuoteInputSchema.parse({ ...valid, origin: 'USA' })).toThrow();
    expect(() => QuoteInputSchema.parse({ ...valid, origin: 'U' })).toThrow();
  });

  it('rejects dest that is not exactly 2 characters', () => {
    expect(() => QuoteInputSchema.parse({ ...valid, dest: '' })).toThrow();
  });

  it('rejects invalid currency length in itemValue', () => {
    expect(() =>
      QuoteInputSchema.parse({ ...valid, itemValue: { amount: 100, currency: 'US' } })
    ).toThrow();
  });

  it('rejects invalid hs6 format', () => {
    expect(() => QuoteInputSchema.parse({ ...valid, hs6: '12345' })).toThrow();
    expect(() => QuoteInputSchema.parse({ ...valid, hs6: '1234567' })).toThrow();
    expect(() => QuoteInputSchema.parse({ ...valid, hs6: 'abcdef' })).toThrow();
  });

  it('rejects invalid mode', () => {
    expect(() => QuoteInputSchema.parse({ ...valid, mode: 'rail' })).toThrow();
  });

  it('rejects negative quantity', () => {
    expect(() => QuoteInputSchema.parse({ ...valid, quantity: -1 })).toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() => QuoteInputSchema.parse({})).toThrow();
    expect(() => QuoteInputSchema.parse({ origin: 'US' })).toThrow();
  });

  it('round-trips through JSON', () => {
    const result = roundTrip(QuoteInputSchema, valid);
    expect(result).toEqual(valid);
  });
});

// ---------------------------------------------------------------------------
// QuoteResponseSchema
// ---------------------------------------------------------------------------

describe('QuoteResponseSchema', () => {
  const valid = {
    hs6: '854231',
    chargeableKg: 3.5,
    freight: 12.5,
    components: { CIF: 112.5, duty: 5.63, vat: 14.18, fees: 2.0 },
    total: 134.31,
    guaranteedMax: 150.0,
    policy: 'standard',
    componentConfidence: {
      duty: 'authoritative' as const,
      vat: 'authoritative' as const,
      surcharges: 'estimated' as const,
      freight: 'authoritative' as const,
      fx: 'authoritative' as const,
    },
    overallConfidence: 'authoritative' as const,
    missingComponents: [],
    sources: {
      duty: { provider: 'WTO', dataset: 'tariff-2024', asOf: '2024-01-01', effectiveFrom: null },
      vat: { provider: 'EU', dataset: 'vat-rates', asOf: '2024-06-01', effectiveFrom: null },
      surcharges: { provider: null, dataset: null, asOf: null, effectiveFrom: null },
    },
  };

  it('accepts a valid quote response', () => {
    const result = QuoteResponseSchema.parse(valid);
    expect(result.hs6).toBe('854231');
    expect(result.total).toBe(134.31);
    expect(result.overallConfidence).toBe('authoritative');
  });

  it('accepts optional fields (currency, incoterm, deMinimis, explainability, fxRate)', () => {
    const extended = {
      ...valid,
      currency: 'EUR',
      incoterm: 'DDP' as const,
      deMinimis: {
        duty: { thresholdDest: 150, deMinimisBasis: 'CIF' as const, under: true },
        vat: null,
        suppressDuty: true,
        suppressVAT: false,
      },
      fxRate: {
        from: 'USD',
        to: 'EUR',
        rate: 0.92,
        asOf: '2024-06-01',
        derivedFrom: 'ECB',
      },
    };
    const result = QuoteResponseSchema.parse(extended);
    expect(result.currency).toBe('EUR');
    expect(result.incoterm).toBe('DDP');
    expect(result.deMinimis?.suppressDuty).toBe(true);
    expect(result.fxRate?.rate).toBe(0.92);
  });

  it('rejects invalid hs6 in response', () => {
    expect(() => QuoteResponseSchema.parse({ ...valid, hs6: '123' })).toThrow();
  });

  it('rejects invalid incoterm', () => {
    expect(() => QuoteResponseSchema.parse({ ...valid, incoterm: 'FOB' })).toThrow();
  });

  it('rejects invalid confidence value', () => {
    expect(() =>
      QuoteResponseSchema.parse({
        ...valid,
        componentConfidence: { ...valid.componentConfidence, duty: 'unknown' },
      })
    ).toThrow();
  });

  it('rejects invalid missingComponents entry', () => {
    expect(() =>
      QuoteResponseSchema.parse({ ...valid, missingComponents: ['insurance'] })
    ).toThrow();
  });

  it('round-trips through JSON', () => {
    const result = roundTrip(QuoteResponseSchema, valid);
    expect(result).toEqual(valid);
  });
});

// ---------------------------------------------------------------------------
// QuoteRecentRowSchema
// ---------------------------------------------------------------------------

describe('QuoteRecentRowSchema', () => {
  const valid = {
    createdAt: '2026-03-06T12:00:00Z',
    idemKey: 'q-abc-123',
    origin: 'US',
    dest: 'DE',
    mode: 'sea' as const,
    hs6: '854231',
    currency: 'USD',
    itemValue: 250,
    total: 310.5,
    duty: 15.0,
    vat: 45.5,
    fees: 0,
  };

  it('accepts a valid recent row', () => {
    const result = QuoteRecentRowSchema.parse(valid);
    expect(result.idemKey).toBe('q-abc-123');
  });

  it('accepts nullable fields', () => {
    const result = QuoteRecentRowSchema.parse({
      ...valid,
      mode: null,
      hs6: null,
      currency: null,
      itemValue: null,
      vat: null,
    });
    expect(result.mode).toBeNull();
    expect(result.hs6).toBeNull();
  });

  it('rejects missing createdAt', () => {
    const { createdAt: _, ...rest } = valid;
    expect(() => QuoteRecentRowSchema.parse(rest)).toThrow();
  });

  it('round-trips through JSON', () => {
    expect(roundTrip(QuoteRecentRowSchema, valid)).toEqual(valid);
  });
});

// ---------------------------------------------------------------------------
// QuoteStatsResponseSchema
// ---------------------------------------------------------------------------

describe('QuoteStatsResponseSchema', () => {
  const valid = {
    last24h: { count: 42 },
    last7d: { count: 280 },
  };

  it('accepts valid stats', () => {
    const result = QuoteStatsResponseSchema.parse(valid);
    expect(result.last24h.count).toBe(42);
  });

  it('rejects missing last7d', () => {
    expect(() => QuoteStatsResponseSchema.parse({ last24h: { count: 1 } })).toThrow();
  });

  it('round-trips through JSON', () => {
    expect(roundTrip(QuoteStatsResponseSchema, valid)).toEqual(valid);
  });
});

// ---------------------------------------------------------------------------
// ClassifyInputSchema
// ---------------------------------------------------------------------------

describe('ClassifyInputSchema', () => {
  it('accepts a minimal classify input', () => {
    const result = ClassifyInputSchema.parse({ title: 'Wireless Headphones' });
    expect(result.title).toBe('Wireless Headphones');
  });

  it('accepts all optional fields', () => {
    const result = ClassifyInputSchema.parse({
      title: 'Laptop',
      description: 'A portable computer',
      categoryKey: 'electronics',
      origin: 'CN',
    });
    expect(result.categoryKey).toBe('electronics');
    expect(result.origin).toBe('CN');
  });

  it('rejects empty title', () => {
    expect(() => ClassifyInputSchema.parse({ title: '' })).toThrow();
  });

  it('rejects origin with wrong length', () => {
    expect(() => ClassifyInputSchema.parse({ title: 'X', origin: 'USA' })).toThrow();
  });

  it('round-trips through JSON', () => {
    const data = { title: 'Widget', description: 'A small widget', origin: 'DE' };
    expect(roundTrip(ClassifyInputSchema, data)).toEqual(data);
  });
});

// ---------------------------------------------------------------------------
// ClassifyResponseSchema
// ---------------------------------------------------------------------------

describe('ClassifyResponseSchema', () => {
  const valid = {
    hs6: '854231',
    confidence: 0.95,
    candidates: [
      { hs6: '854231', title: 'Headphones', score: 0.95 },
      { hs6: '851830', title: 'Earphones', score: 0.72 },
    ],
  };

  it('accepts a valid classify response', () => {
    const result = ClassifyResponseSchema.parse(valid);
    expect(result.hs6).toBe('854231');
    expect(result.candidates).toHaveLength(2);
  });

  it('accepts without optional candidates', () => {
    const result = ClassifyResponseSchema.parse({ hs6: '854231', confidence: 0.8 });
    expect(result.candidates).toBeUndefined();
  });

  it('rejects confidence out of range', () => {
    expect(() => ClassifyResponseSchema.parse({ hs6: '854231', confidence: 1.5 })).toThrow();
    expect(() => ClassifyResponseSchema.parse({ hs6: '854231', confidence: -0.1 })).toThrow();
  });

  it('rejects invalid hs6 in candidates', () => {
    expect(() =>
      ClassifyResponseSchema.parse({
        hs6: '854231',
        confidence: 0.9,
        candidates: [{ hs6: 'bad', title: 'X', score: 0.5 }],
      })
    ).toThrow();
  });

  it('round-trips through JSON', () => {
    expect(roundTrip(ClassifyResponseSchema, valid)).toEqual(valid);
  });
});
