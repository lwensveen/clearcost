import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withIdempotencyMock: vi.fn(),
  classifyHS6Mock: vi.fn(),
}));

vi.mock('../../lib/idempotency.js', () => ({
  withIdempotency: mocks.withIdempotencyMock,
}));

vi.mock('./services/classify-hs6.js', () => ({
  classifyHS6: mocks.classifyHS6Mock,
}));

import classifyRoutes from './routes.js';

const sampleResult = {
  hs6: '854231',
  confidence: 0.92,
  candidates: [
    { hs6: '854231', title: 'Electronic integrated circuits: Processors', score: 0.92 },
    { hs6: '854239', title: 'Other electronic ICs', score: 0.78 },
  ],
};

const validInput = { title: 'Laptop processor chip' };

async function buildApp() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('requireApiKey', () => async (req: any) => {
    req.apiKey = { id: 'api_1', ownerId: 'owner_1' };
  });
  await app.register(classifyRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.classifyHS6Mock.mockResolvedValue(sampleResult);
  mocks.withIdempotencyMock.mockImplementation(async (_ns, _key, _body, compute) => compute());
});

describe('classify routes', () => {
  it('POST / returns classification result', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/',
      headers: { 'idempotency-key': 'idem_1' },
      payload: validInput,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ hs6: '854231', confidence: 0.92 });
    expect(mocks.classifyHS6Mock).toHaveBeenCalledWith(validInput);
    await app.close();
  });

  it('POST / supports x-idempotency-key header', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/',
      headers: { 'x-idempotency-key': 'idem_x_1' },
      payload: validInput,
    });

    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('POST / passes correct namespace to idempotency', async () => {
    const app = await buildApp();
    await app.inject({
      method: 'POST',
      url: '/',
      headers: { 'idempotency-key': 'idem_ns' },
      payload: validInput,
    });

    expect(mocks.withIdempotencyMock).toHaveBeenCalledWith(
      'classify:owner_1',
      'idem_ns',
      expect.objectContaining({ title: 'Laptop processor chip' }),
      expect.any(Function)
    );
    await app.close();
  });

  it('POST / returns 400 on missing title', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/',
      headers: { 'idempotency-key': 'idem_bad' },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('POST / accepts optional description and origin', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/',
      headers: { 'idempotency-key': 'idem_full' },
      payload: { title: 'Widget', description: 'A small widget', origin: 'CN' },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.classifyHS6Mock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Widget', description: 'A small widget', origin: 'CN' })
    );
    await app.close();
  });
});
