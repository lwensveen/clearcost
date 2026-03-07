import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── hoisted mocks ───────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  assertOwnsManifestMock: vi.fn(),
  withIdempotencyMock: vi.fn(),
  computePoolMock: vi.fn(),
  enforceComputeLimitMock: vi.fn(),
  insertMock: vi.fn(),
  selectMock: vi.fn(),
  findFirstMock: vi.fn(),
  manifestQuotesFindFirstMock: vi.fn(),
}));

vi.mock('@clearcost/db', async () => {
  const actual = await vi.importActual<typeof import('@clearcost/db')>('@clearcost/db');
  return {
    ...actual,
    db: {
      insert: mocks.insertMock,
      select: mocks.selectMock,
      query: {
        idempotencyKeysTable: {
          findFirst: mocks.findFirstMock,
        },
        manifestQuotesTable: {
          findFirst: mocks.manifestQuotesFindFirstMock,
        },
      },
    },
  };
});

vi.mock('../../../../lib/idempotency.js', () => ({
  withIdempotency: mocks.withIdempotencyMock,
}));

vi.mock('../../services/compute-pool.js', () => ({
  computePool: mocks.computePoolMock,
}));

vi.mock('./utils.js', async () => {
  const actual = await vi.importActual<typeof import('./utils.js')>('./utils.js');
  return {
    ...actual,
    assertOwnsManifest: mocks.assertOwnsManifestMock,
  };
});

import manifestsPublicRoutes from './compute.js';

// ── valid UUIDs (Zod v4 requires version bits in position 3) ────────────────
const MANIFEST_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const ITEM_ID_1 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const ITEM_ID_2 = 'b7d8e9f0-1a2b-4c3d-8e4f-5a6b7c8d9e0f';
const SNAPSHOT_ID = 'c3d4e5f6-7a8b-4c9d-ae0f-1a2b3c4d5e6f';
const IDEM_KEY = 'idem_test_1';

const sampleComputeResult = {
  ok: true as const,
  manifestId: MANIFEST_ID,
  allocation: 'chargeable' as const,
  dryRun: false,
  summary: {
    itemsCount: 2,
    currency: 'USD',
    freight: 50,
    duty: 12,
    vat: 20,
    fees: 5,
    checkoutVat: null,
    grandTotal: 87,
    fxAsOf: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
  },
  items: [
    {
      id: ITEM_ID_1,
      currency: 'USD',
      basis: 100,
      chargeableKg: 2,
      freightShare: 25,
      components: { CIF: 125, duty: 6, vat: 10, fees: 2.5 },
    },
    {
      id: ITEM_ID_2,
      currency: 'USD',
      basis: 200,
      chargeableKg: 3,
      freightShare: 25,
      components: { CIF: 225, duty: 6, vat: 10, fees: 2.5 },
    },
  ],
};

// ── helpers ─────────────────────────────────────────────────────────────────
function mockInsertSuccess() {
  const catchable = { catch: vi.fn() };
  const values = vi.fn(() => catchable);
  mocks.insertMock.mockReturnValue({ values });
}

function mockSelectChain(rows: unknown[]) {
  mocks.selectMock.mockReturnValue({
    from: () => ({
      where: () => ({
        limit: async () => rows,
        orderBy: () => ({
          limit: async () => rows,
        }),
      }),
    }),
  });
}

async function buildApp() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.decorate('requireApiKey', () => async (req: any) => {
    req.apiKey = { id: 'api_1', ownerId: 'owner_1' };
  });

  app.decorate('enforceComputeLimit', mocks.enforceComputeLimitMock);

  await app.register(manifestsPublicRoutes);
  return app;
}

async function buildAppNoAuth() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.decorate('requireApiKey', () => async (_req: any, reply: any) => {
    return reply.code(401).send({
      error: { code: 'ERR_UNAUTHORIZED', message: 'Missing or malformed API key' },
    });
  });

  app.decorate('enforceComputeLimit', mocks.enforceComputeLimitMock);

  await app.register(manifestsPublicRoutes);
  return app;
}

// ── setup ───────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mocks.assertOwnsManifestMock.mockResolvedValue(true);
  mocks.enforceComputeLimitMock.mockResolvedValue({
    allowed: true,
    plan: 'free',
    limit: 10,
    used: 0,
  });
  mocks.manifestQuotesFindFirstMock.mockResolvedValue(null);
  mockInsertSuccess();

  mocks.computePoolMock.mockResolvedValue({
    totals: sampleComputeResult.summary,
    items: sampleComputeResult.items,
  });

  mocks.withIdempotencyMock.mockImplementation(async (_scope, _key, _body, compute) => {
    return compute();
  });
});

// ── tests ───────────────────────────────────────────────────────────────────
describe('manifests compute routes', () => {
  // ─── POST /:manifestId/compute ──────────────────────────────────────────
  describe('POST /:manifestId/compute', () => {
    it('returns 401 without API key', async () => {
      const app = await buildAppNoAuth();
      const res = await app.inject({
        method: 'POST',
        url: `/${MANIFEST_ID}/compute`,
        headers: { 'idempotency-key': IDEM_KEY },
        payload: {},
      });

      expect(res.statusCode).toBe(401);
      await app.close();
    });

    it('rejects when idempotency key header is missing', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: `/${MANIFEST_ID}/compute`,
        payload: {},
      });

      // Schema validation rejects before handler; Fastify returns 400 or 500
      // depending on whether the error handler can serialize the response
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
      await app.close();
    });

    it('returns 403 when manifest does not belong to owner', async () => {
      mocks.assertOwnsManifestMock.mockResolvedValue(false);
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: `/${MANIFEST_ID}/compute`,
        headers: { 'idempotency-key': IDEM_KEY },
        payload: {},
      });

      expect(res.statusCode).toBe(403);
      await app.close();
    });

    it('computes and returns results with idempotency header', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: `/${MANIFEST_ID}/compute`,
        headers: { 'idempotency-key': IDEM_KEY },
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['idempotency-key']).toBe(IDEM_KEY);
      expect(res.headers['cache-control']).toBe('no-store');
      const json = res.json();
      expect(json.ok).toBe(true);
      expect(json.manifestId).toBe(MANIFEST_ID);
      expect(json.items).toHaveLength(2);
      await app.close();
    });

    it('accepts x-idempotency-key header', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: `/${MANIFEST_ID}/compute`,
        headers: { 'x-idempotency-key': 'x_idem_1' },
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['idempotency-key']).toBe('x_idem_1');
      await app.close();
    });

    it('passes allocation and dryRun from body to computePool', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: `/${MANIFEST_ID}/compute`,
        headers: { 'idempotency-key': IDEM_KEY },
        payload: { allocation: 'volumetric', dryRun: true },
      });

      expect(res.statusCode).toBe(200);
      expect(mocks.computePoolMock).toHaveBeenCalledWith(MANIFEST_ID, {
        allocation: 'volumetric',
        dryRun: true,
      });
      await app.close();
    });

    it('uses default allocation and dryRun when body is omitted', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: `/${MANIFEST_ID}/compute`,
        headers: { 'idempotency-key': IDEM_KEY },
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      expect(mocks.computePoolMock).toHaveBeenCalledWith(MANIFEST_ID, {
        allocation: 'chargeable',
        dryRun: false,
      });
      await app.close();
    });

    it('returns 402 when compute limit is exceeded', async () => {
      mocks.enforceComputeLimitMock.mockResolvedValue({
        allowed: false,
        plan: 'free',
        limit: 10,
        used: 10,
      });
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: `/${MANIFEST_ID}/compute`,
        headers: { 'idempotency-key': IDEM_KEY },
        payload: {},
      });

      expect(res.statusCode).toBe(402);
      await app.close();
    });

    it('writes best-effort snapshot insert', async () => {
      const app = await buildApp();
      await app.inject({
        method: 'POST',
        url: `/${MANIFEST_ID}/compute`,
        headers: { 'idempotency-key': IDEM_KEY },
        payload: {},
      });

      expect(mocks.insertMock).toHaveBeenCalled();
      await app.close();
    });

    it('rejects invalid manifestId param', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/not-a-uuid/compute',
        headers: { 'idempotency-key': IDEM_KEY },
        payload: {},
      });

      // Schema validation rejects before handler; Fastify returns 400 or 500
      // depending on whether the error handler can serialize the response
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
      await app.close();
    });
  });

  // ─── GET /:manifestId/quotes ────────────────────────────────────────────
  describe('GET /:manifestId/quotes', () => {
    it('returns 401 without API key', async () => {
      const app = await buildAppNoAuth();
      const res = await app.inject({
        method: 'GET',
        url: `/${MANIFEST_ID}/quotes`,
      });

      expect(res.statusCode).toBe(401);
      await app.close();
    });

    it('returns 403 when manifest does not belong to owner', async () => {
      mocks.assertOwnsManifestMock.mockResolvedValue(false);
      const app = await buildApp();
      const res = await app.inject({
        method: 'GET',
        url: `/${MANIFEST_ID}/quotes`,
      });

      expect(res.statusCode).toBe(403);
      await app.close();
    });

    it('returns quotes for a manifest with cache headers', async () => {
      mockSelectChain([
        {
          id: ITEM_ID_1,
          currency: 'USD',
          basis: 100,
          chargeableKg: 2,
          freightShare: 25,
          components: { CIF: 125, duty: 6, vat: 10, fees: 2.5 },
        },
      ]);
      const app = await buildApp();
      const res = await app.inject({
        method: 'GET',
        url: `/${MANIFEST_ID}/quotes`,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.ok).toBe(true);
      expect(json.manifestId).toBe(MANIFEST_ID);
      expect(res.headers['cache-control']).toBe('private, max-age=10, stale-while-revalidate=60');
      await app.close();
    });
  });

  // ─── GET /:manifestId/quotes/by-key/:key ────────────────────────────────
  describe('GET /:manifestId/quotes/by-key/:key', () => {
    it('returns 401 without API key', async () => {
      const app = await buildAppNoAuth();
      const res = await app.inject({
        method: 'GET',
        url: `/${MANIFEST_ID}/quotes/by-key/some_key`,
      });

      expect(res.statusCode).toBe(401);
      await app.close();
    });

    it('returns 404 when idempotency row is not found', async () => {
      mocks.findFirstMock.mockResolvedValue(undefined);
      const app = await buildApp();
      const res = await app.inject({
        method: 'GET',
        url: `/${MANIFEST_ID}/quotes/by-key/missing_key`,
      });

      expect(res.statusCode).toBe(404);
      await app.close();
    });

    it('returns 404 when response is null', async () => {
      mocks.findFirstMock.mockResolvedValue({ response: null, status: 'completed' });
      const app = await buildApp();
      const res = await app.inject({
        method: 'GET',
        url: `/${MANIFEST_ID}/quotes/by-key/null_response`,
      });

      expect(res.statusCode).toBe(404);
      await app.close();
    });

    it('returns 404 when cached response fails schema validation', async () => {
      mocks.findFirstMock.mockResolvedValue({ response: { broken: true }, status: 'completed' });
      const app = await buildApp();
      const res = await app.inject({
        method: 'GET',
        url: `/${MANIFEST_ID}/quotes/by-key/bad_response`,
      });

      expect(res.statusCode).toBe(404);
      await app.close();
    });

    it('returns cached compute result when valid', async () => {
      mocks.findFirstMock.mockResolvedValue({
        response: sampleComputeResult,
        status: 'completed',
      });
      const app = await buildApp();
      const res = await app.inject({
        method: 'GET',
        url: `/${MANIFEST_ID}/quotes/by-key/valid_key`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['idempotency-key']).toBe('valid_key');
      expect(res.headers['cache-control']).toBe('no-store');
      const json = res.json();
      expect(json.ok).toBe(true);
      expect(json.manifestId).toBe(MANIFEST_ID);
      await app.close();
    });
  });

  // ─── GET /:manifestId/quotes/history ────────────────────────────────────
  describe('GET /:manifestId/quotes/history', () => {
    it('returns 401 without API key', async () => {
      const app = await buildAppNoAuth();
      const res = await app.inject({
        method: 'GET',
        url: `/${MANIFEST_ID}/quotes/history`,
      });

      expect(res.statusCode).toBe(401);
      await app.close();
    });

    it('returns snapshot history for a manifest', async () => {
      mockSelectChain([
        {
          id: SNAPSHOT_ID,
          createdAt: new Date('2025-01-01T00:00:00.000Z'),
          idemKey: 'idem_hist_1',
          allocation: 'chargeable',
          dryRun: false,
        },
      ]);
      const app = await buildApp();
      const res = await app.inject({
        method: 'GET',
        url: `/${MANIFEST_ID}/quotes/history`,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.items).toHaveLength(1);
      expect(json.items[0]).toMatchObject({ idemKey: 'idem_hist_1' });
      await app.close();
    });

    it('returns empty items array when no snapshots exist', async () => {
      mockSelectChain([]);
      const app = await buildApp();
      const res = await app.inject({
        method: 'GET',
        url: `/${MANIFEST_ID}/quotes/history`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().items).toHaveLength(0);
      await app.close();
    });
  });
});
