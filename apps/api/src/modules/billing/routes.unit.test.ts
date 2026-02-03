import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mapPlanFromPrice, resolveSubscriptionState, validateBillingEnv } from './routes.js';

const envSnapshot = { ...process.env };

describe('validateBillingEnv', () => {
  beforeEach(() => {
    process.env = { ...envSnapshot };
  });

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it('returns parsed billing env when required vars are present', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_example';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_example';
    process.env.STRIPE_PRICE_STARTER = 'price_starter';
    process.env.STRIPE_PRICE_GROWTH = 'price_growth';
    process.env.STRIPE_PRICE_SCALE = 'price_scale';

    const env = validateBillingEnv({ webhookEnabled: true });

    expect(env).toEqual({
      stripeSecretKey: 'sk_test_example',
      webhookSecret: 'whsec_example',
      price: {
        starter: 'price_starter',
        growth: 'price_growth',
        scale: 'price_scale',
      },
    });
  });

  it('throws with a clear list of missing vars', () => {
    process.env.STRIPE_SECRET_KEY = '';
    process.env.STRIPE_WEBHOOK_SECRET = '';
    process.env.STRIPE_PRICE_STARTER = '';
    process.env.STRIPE_PRICE_GROWTH = 'price_growth';
    process.env.STRIPE_PRICE_SCALE = '';

    expect(() => validateBillingEnv({ webhookEnabled: true })).toThrowError(
      'Missing required billing env vars: STRIPE_SECRET_KEY, STRIPE_PRICE_STARTER, STRIPE_PRICE_SCALE, STRIPE_WEBHOOK_SECRET'
    );
  });

  it('does not require webhook secret when webhook checks are disabled', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_example';
    process.env.STRIPE_WEBHOOK_SECRET = '';
    process.env.STRIPE_PRICE_STARTER = 'price_starter';
    process.env.STRIPE_PRICE_GROWTH = 'price_growth';
    process.env.STRIPE_PRICE_SCALE = 'price_scale';

    const env = validateBillingEnv({ webhookEnabled: false });
    expect(env.webhookSecret).toBe('');
  });
});

describe('billing subscription mapping', () => {
  const price = {
    starter: 'price_starter',
    growth: 'price_growth',
    scale: 'price_scale',
  } as const;

  it('maps known price ids to plan names', () => {
    expect(mapPlanFromPrice('price_starter', price, 'free')).toBe('starter');
    expect(mapPlanFromPrice('price_growth', price, 'free')).toBe('growth');
    expect(mapPlanFromPrice('price_scale', price, 'free')).toBe('scale');
  });

  it('falls back when the price id is unknown', () => {
    expect(mapPlanFromPrice('price_other', price, 'unknown')).toBe('unknown');
  });

  it('resolves webhook state from Stripe subscription payload', () => {
    const sub = {
      status: 'active',
      current_period_end: 1_735_689_600,
      items: {
        data: [{ price: { id: 'price_growth' } }],
      },
    } as unknown as import('stripe').default.Subscription;

    const out = resolveSubscriptionState(sub, price, 'free');
    expect(out.plan).toBe('growth');
    expect(out.status).toBe('active');
    expect(out.priceId).toBe('price_growth');
    expect(out.currentPeriodEnd?.toISOString()).toBe('2025-01-01T00:00:00.000Z');
  });
});
