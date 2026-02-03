import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('pdf-parse', () => ({
  default: async () => ({ text: '' }),
}));

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

describe('server boundaries', () => {
  it('does not expose internal routes on the public server', async () => {
    const { buildPublicServer } = await import('./server.js');
    const app = await buildPublicServer();
    const res = await app.inject({ method: 'GET', url: '/internal/healthz' });
    const res2 = await app.inject({ method: 'GET', url: '/internal/cron/fx/daily' });
    const res3 = await app.inject({ method: 'GET', url: '/metrics' });

    expect(res.statusCode).toBe(404);
    expect(res2.statusCode).toBe(404);
    expect(res3.statusCode).toBe(404);

    await app.close();
  });

  it('requires internal signing for internal routes in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.INTERNAL_SIGNING_SECRET = 'test-secret';

    const { buildInternalServer } = await import('./server.js');
    const app = await buildInternalServer({
      enableImportMetrics: false,
      enableImportInstrumentation: false,
      enableHttpMetrics: false,
    });

    const res = await app.inject({ method: 'GET', url: '/internal/notices' });
    expect(res.statusCode).toBe(401);

    const payload = res.json() as { message?: string; error?: string };
    expect(payload).toBeTruthy();

    await app.close();
  });
});
