import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDeMinimis: vi.fn(),
  evaluateDeMinimis: vi.fn(),
}));

vi.mock('./services/get-de-minimis.js', () => ({
  getDeMinimis: mocks.getDeMinimis,
}));

vi.mock('./services/evaluate.js', () => ({
  evaluateDeMinimis: mocks.evaluateDeMinimis,
}));

import deMinimisRoutes from './routes.js';

const thresholdResult = {
  duty: { currency: 'USD', value: 800, deMinimisBasis: 'INTRINSIC' as const },
  vat: null,
};

const evalResult = {
  duty: { thresholdDest: 800, deMinimisBasis: 'INTRINSIC' as const, under: true },
  suppressDuty: true,
  suppressVAT: false,
};

async function buildApp() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('requireApiKey', () => async (req: any) => {
    req.apiKey = { id: 'api_1', ownerId: 'owner_1' };
  });
  await app.register(deMinimisRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDeMinimis.mockResolvedValue(thresholdResult);
  mocks.evaluateDeMinimis.mockResolvedValue(evalResult);
});

describe('de-minimis routes', () => {
  describe('GET /', () => {
    it('returns threshold data for a destination', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'GET',
        url: '/?dest=US',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        duty: { currency: 'USD', value: 800 },
        vat: null,
      });
      expect(mocks.getDeMinimis).toHaveBeenCalledWith('US', expect.any(Date));
      await app.close();
    });

    it('uppercases destination country code', async () => {
      const app = await buildApp();
      await app.inject({ method: 'GET', url: '/?dest=us' });

      expect(mocks.getDeMinimis).toHaveBeenCalledWith('US', expect.any(Date));
      await app.close();
    });

    it('passes the on date when provided', async () => {
      const app = await buildApp();
      await app.inject({ method: 'GET', url: '/?dest=US&on=2025-06-15' });

      const call = mocks.getDeMinimis.mock.calls[0]!;
      expect(call[0]).toBe('US');
      expect(call[1]).toBeInstanceOf(Date);
      await app.close();
    });

    it('returns 400 when dest is missing', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/' });

      expect(res.statusCode).toBe(400);
      await app.close();
    });
  });

  describe('POST /evaluate', () => {
    it('evaluates goods against de-minimis thresholds', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/evaluate',
        payload: { dest: 'US', goodsDest: 500, freightDest: 50 },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ suppressDuty: true, suppressVAT: false });
      await app.close();
    });

    it('uppercases destination in evaluate', async () => {
      const app = await buildApp();
      await app.inject({
        method: 'POST',
        url: '/evaluate',
        payload: { dest: 'de', goodsDest: 100 },
      });

      expect(mocks.evaluateDeMinimis).toHaveBeenCalledWith(expect.objectContaining({ dest: 'DE' }));
      await app.close();
    });

    it('returns 400 when goodsDest is missing', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/evaluate',
        payload: { dest: 'US' },
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });
  });
});
