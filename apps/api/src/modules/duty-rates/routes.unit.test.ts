import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withIdempotencyMock: vi.fn(),
  importDutyRatesMock: vi.fn(),
}));

vi.mock('../../lib/idempotency.js', () => ({
  withIdempotency: mocks.withIdempotencyMock,
}));

vi.mock('./services/import-duty-rates.js', () => ({
  importDutyRates: mocks.importDutyRatesMock,
}));

import dutyRoutes from './routes.js';

async function buildApp() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('requireApiKey', () => async (req: any) => {
    req.apiKey = { id: 'api_1', ownerId: 'owner_1' };
  });
  await app.register(dutyRoutes);
  return app;
}

// Minimal valid duty-rate row for the insert schema (column names from drizzle)
const sampleRow = {
  dest: 'US',
  partner: 'CN',
  hs6: '854231',
  ratePct: '25.00',
  dutyRule: 'mfn',
  source: 'official',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.importDutyRatesMock.mockResolvedValue({ count: 1 });
  mocks.withIdempotencyMock.mockImplementation(async (_ns, _key, _body, compute) => compute());
});

describe('duty-rates routes', () => {
  it('POST /import with dryRun returns count without importing', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/import?dryRun=true',
      headers: { 'idempotency-key': 'idem_dry' },
      payload: [sampleRow],
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, count: 1 });
    expect(mocks.importDutyRatesMock).not.toHaveBeenCalled();
    expect(mocks.withIdempotencyMock).not.toHaveBeenCalled();
    await app.close();
  });

  it('POST /import triggers import via idempotency', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/import',
      headers: { 'idempotency-key': 'idem_import' },
      payload: [sampleRow],
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, count: 1 });
    expect(mocks.withIdempotencyMock).toHaveBeenCalledWith(
      'import:duties:owner_1',
      'idem_import',
      { count: 1 },
      expect.any(Function)
    );
    await app.close();
  });

  it('POST /import falls back to rows.length when service returns null count', async () => {
    mocks.importDutyRatesMock.mockResolvedValue(null);
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/import',
      headers: { 'idempotency-key': 'idem_null' },
      payload: [sampleRow, sampleRow],
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, count: 2 });
    await app.close();
  });

  it('POST /import returns 400 on empty array', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/import',
      headers: { 'idempotency-key': 'idem_empty' },
      payload: [],
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
