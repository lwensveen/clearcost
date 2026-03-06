import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/env.js', () => ({
  resolveMetricsRequireSigning: () => false,
}));

import metricsRoutes from './routes.js';
import { registry } from '../../lib/metrics.js';

async function buildApp() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('requireApiKey', () => async (req: any) => {
    req.apiKey = { id: 'api_1', ownerId: 'owner_1' };
  });
  await app.register(metricsRoutes);
  return app;
}

beforeEach(() => {
  registry.resetMetrics();
});

describe('metrics routes', () => {
  it('GET /metrics returns prometheus text format', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/metrics' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/');
    expect(res.headers['cache-control']).toBe('no-store');
    await app.close();
  });

  it('GET /metrics returns non-empty body', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/metrics' });

    expect(res.statusCode).toBe(200);
    // Prometheus output always has at least default metrics
    expect(res.body.length).toBeGreaterThan(0);
    await app.close();
  });
});
