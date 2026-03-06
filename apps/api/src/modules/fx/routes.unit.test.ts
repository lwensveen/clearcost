import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withIdempotencyMock: vi.fn(),
  refreshFxMock: vi.fn(),
}));

vi.mock('../../lib/idempotency.js', () => ({
  withIdempotency: mocks.withIdempotencyMock,
}));

vi.mock('../../lib/refresh-fx.js', () => ({
  refreshFx: mocks.refreshFxMock,
}));

import fxRoutes from './routes.js';

async function buildApp() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('requireApiKey', () => async (req: any) => {
    req.apiKey = { id: 'api_1', ownerId: 'owner_1' };
  });
  await app.register(fxRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.refreshFxMock.mockResolvedValue({
    base: 'EUR',
    fxAsOf: new Date('2025-06-01T12:00:00.000Z'),
    inserted: 42,
  });
  mocks.withIdempotencyMock.mockImplementation(async (_ns, _key, _body, compute) => compute());
});

describe('fx routes', () => {
  it('POST /refresh returns base, fxAsOf and attemptedInserts', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/refresh',
      headers: { 'idempotency-key': 'idem_fx_1' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.base).toBe('EUR');
    expect(body.fxAsOf).toBe('2025-06-01T12:00:00.000Z');
    expect(body.attemptedInserts).toBe(42);
    await app.close();
  });

  it('POST /refresh handles string fxAsOf from service', async () => {
    mocks.refreshFxMock.mockResolvedValue({
      base: 'USD',
      fxAsOf: '2025-03-01T00:00:00.000Z',
      inserted: 10,
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/refresh',
      headers: { 'idempotency-key': 'idem_fx_str' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().fxAsOf).toBe('2025-03-01T00:00:00.000Z');
    await app.close();
  });

  it('POST /refresh defaults inserted to 0 when missing', async () => {
    mocks.refreshFxMock.mockResolvedValue({
      base: 'EUR',
      fxAsOf: new Date('2025-06-01T12:00:00.000Z'),
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/refresh',
      headers: { 'idempotency-key': 'idem_fx_zero' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().attemptedInserts).toBe(0);
    await app.close();
  });

  it('POST /refresh passes correct idempotency namespace', async () => {
    const app = await buildApp();
    await app.inject({
      method: 'POST',
      url: '/refresh',
      headers: { 'idempotency-key': 'idem_fx_ns' },
    });

    expect(mocks.withIdempotencyMock).toHaveBeenCalledWith(
      'fx:refresh:owner_1',
      'idem_fx_ns',
      {},
      expect.any(Function)
    );
    await app.close();
  });
});
