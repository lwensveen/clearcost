import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateBillingEnv } from './routes.js';

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
