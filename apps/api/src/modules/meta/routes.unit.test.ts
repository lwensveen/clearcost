import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MetaCapabilitiesResponseSchema } from '@clearcost/types';

const envSnapshot = { ...process.env };

beforeEach(() => {
  process.env = { ...envSnapshot };
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy';
  process.env.STRIPE_PRICE_STARTER = 'price_starter_dummy';
  process.env.STRIPE_PRICE_GROWTH = 'price_growth_dummy';
  process.env.STRIPE_PRICE_SCALE = 'price_scale_dummy';
  process.env.INTERNAL_SIGNING_SECRET = 'test-secret';
  process.env.API_KEY_PEPPER = 'pepper_dummy';
});

afterEach(() => {
  process.env = { ...envSnapshot };
});

describe('meta capabilities route', () => {
  it('returns dataset capabilities shape with known datasets', async () => {
    const { buildPublicServer } = await import('../../server.js');
    const app = await buildPublicServer();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/_meta/capabilities',
    });

    expect(res.statusCode).toBe(200);

    const parsed = MetaCapabilitiesResponseSchema.parse(res.json());
    expect(Object.keys(parsed.datasets).length).toBeGreaterThanOrEqual(5);
    expect(parsed.datasets.duties.supportedRegions.length).toBeGreaterThan(0);
    expect(parsed.datasets.vat.supportedRegions.length).toBeGreaterThan(0);
    expect(parsed.datasets.fx.freshnessThresholdHours).toBe(30);

    await app.close();
  });
});
