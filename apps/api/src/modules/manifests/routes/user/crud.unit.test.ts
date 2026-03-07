import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── hoisted mocks ───────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  selectMock: vi.fn(),
  insertMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
  assertOwnsManifestMock: vi.fn(),
  guardCreateManifestMock: vi.fn(),
  guardAppendItemsMock: vi.fn(),
}));

vi.mock('@clearcost/db', async () => {
  const actual = await vi.importActual<typeof import('@clearcost/db')>('@clearcost/db');
  return {
    ...actual,
    db: {
      select: mocks.selectMock,
      insert: mocks.insertMock,
      update: mocks.updateMock,
      delete: mocks.deleteMock,
    },
  };
});

vi.mock('./utils.js', async () => {
  const actual = await vi.importActual<typeof import('./utils.js')>('./utils.js');
  return {
    ...actual,
    assertOwnsManifest: mocks.assertOwnsManifestMock,
  };
});

import manifestsCrud from './crud.js';

// ── valid UUIDs (Zod v4 requires version bits in position 3) ────────────────
const MANIFEST_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const OWNER_ID = 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a';
const ITEM_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

const sampleManifestRow = {
  id: MANIFEST_ID,
  ownerId: OWNER_ID,
  origin: 'CN',
  dest: 'DE',
  shippingMode: 'air',
  pricingMode: 'cards',
  name: 'Test manifest',
  fixedFreightTotal: null,
  fixedFreightCurrency: null,
  reference: null,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
};

const createPayload = {
  origin: 'CN',
  dest: 'DE',
  shippingMode: 'air' as const,
  pricingMode: 'cards' as const,
  name: 'New manifest',
};

const sampleItemRow = {
  id: ITEM_ID,
  manifestId: MANIFEST_ID,
  itemValueAmount: '100.0000',
  itemValueCurrency: 'USD',
  dimsCm: { l: 10, w: 10, h: 10 },
  weightKg: '2.000',
  quantity: null,
  liters: null,
  hs6: '123456',
  categoryKey: 'apparel',
  reference: null,
  notes: null,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
};

// ── helpers ─────────────────────────────────────────────────────────────────

/** Mock for select chains that include orderBy (LIST routes). */
function mockSelectListReturns(rows: unknown[]) {
  mocks.selectMock.mockReturnValue({
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: async () => rows,
        }),
      }),
    }),
  });
}

/** Mock for select chains without orderBy (GET-by-id). */
function mockSelectByIdReturns(rows: unknown[]) {
  mocks.selectMock.mockReturnValue({
    from: () => ({
      where: () => ({
        limit: async () => rows,
      }),
    }),
  });
}

function mockInsertReturning(rows: unknown[]) {
  mocks.insertMock.mockReturnValue({
    values: () => ({
      returning: async () => rows,
    }),
  });
}

function mockInsertThen(result: unknown) {
  mocks.insertMock.mockReturnValue({
    values: () => ({
      then: (cb: (v: unknown) => unknown) => Promise.resolve(cb(result)),
    }),
  });
}

function mockUpdateThen(result: unknown) {
  mocks.updateMock.mockReturnValue({
    set: () => ({
      where: () => ({
        then: (cb: (v: unknown) => unknown) => Promise.resolve(cb(result)),
      }),
    }),
  });
}

function mockUpdateDirect() {
  mocks.updateMock.mockReturnValue({
    set: () => ({
      where: () => Promise.resolve(),
    }),
  });
}

function mockDeleteThen(result: unknown) {
  mocks.deleteMock.mockReturnValue({
    where: () => ({
      then: (cb: (v: unknown) => unknown) => Promise.resolve(cb(result)),
    }),
  });
}

function mockDeleteDirect() {
  mocks.deleteMock.mockReturnValue({
    where: () => Promise.resolve(),
  });
}

async function buildApp() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.decorate('requireApiKey', () => async (req: any) => {
    req.apiKey = { id: 'api_1', ownerId: OWNER_ID };
  });

  app.decorate('entitlements', {
    guardCreateManifest: mocks.guardCreateManifestMock,
    guardAppendItems: mocks.guardAppendItemsMock,
    guardReplaceItems: vi.fn().mockResolvedValue({ allowed: true }),
    getLimitsForOwner: vi.fn().mockResolvedValue({
      plan: 'free',
      maxManifests: 10,
      maxItemsPerManifest: 100,
    }),
  });

  await app.register(manifestsCrud);
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

  app.decorate('entitlements', {
    guardCreateManifest: mocks.guardCreateManifestMock,
    guardAppendItems: mocks.guardAppendItemsMock,
    guardReplaceItems: vi.fn().mockResolvedValue({ allowed: true }),
    getLimitsForOwner: vi.fn(),
  });

  await app.register(manifestsCrud);
  return app;
}

// ── setup ───────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mocks.assertOwnsManifestMock.mockResolvedValue(true);
  mocks.guardCreateManifestMock.mockResolvedValue({ allowed: true });
  mocks.guardAppendItemsMock.mockResolvedValue({ allowed: true });
});

// ── tests ───────────────────────────────────────────────────────────────────
describe('manifests CRUD routes', () => {
  // ─── AUTH ───────────────────────────────────────────────────────────────
  describe('auth enforcement', () => {
    it('GET / returns 401 without API key', async () => {
      const app = await buildAppNoAuth();
      const res = await app.inject({ method: 'GET', url: '/' });
      expect(res.statusCode).toBe(401);
      await app.close();
    });

    it('POST / returns 401 without API key', async () => {
      const app = await buildAppNoAuth();
      const res = await app.inject({ method: 'POST', url: '/', payload: createPayload });
      expect(res.statusCode).toBe(401);
      await app.close();
    });

    it('GET /:id returns 401 without API key', async () => {
      const app = await buildAppNoAuth();
      const res = await app.inject({ method: 'GET', url: `/${MANIFEST_ID}` });
      expect(res.statusCode).toBe(401);
      await app.close();
    });

    it('PATCH /:id returns 401 without API key', async () => {
      const app = await buildAppNoAuth();
      const res = await app.inject({
        method: 'PATCH',
        url: `/${MANIFEST_ID}`,
        payload: { name: 'Updated' },
      });
      expect(res.statusCode).toBe(401);
      await app.close();
    });

    it('DELETE /:id returns 401 without API key', async () => {
      const app = await buildAppNoAuth();
      const res = await app.inject({ method: 'DELETE', url: `/${MANIFEST_ID}` });
      expect(res.statusCode).toBe(401);
      await app.close();
    });
  });

  // ─── LIST MANIFESTS ─────────────────────────────────────────────────────
  describe('GET / (list manifests)', () => {
    it('returns list of manifests for authenticated owner', async () => {
      mockSelectListReturns([sampleManifestRow]);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/' });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.items).toHaveLength(1);
      expect(json.items[0]).toMatchObject({
        id: MANIFEST_ID,
        origin: 'CN',
        dest: 'DE',
        name: 'Test manifest',
      });
      await app.close();
    });

    it('returns empty list when no manifests exist', async () => {
      mockSelectListReturns([]);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/' });

      expect(res.statusCode).toBe(200);
      expect(res.json().items).toHaveLength(0);
      await app.close();
    });

    it('passes optional query filters', async () => {
      mockSelectListReturns([]);
      const app = await buildApp();
      const res = await app.inject({
        method: 'GET',
        url: '/?origin=CN&dest=DE&shippingMode=air&pricingMode=cards&limit=10',
      });

      expect(res.statusCode).toBe(200);
      await app.close();
    });

    it('returns 400 for invalid query params', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'GET',
        url: '/?shippingMode=train',
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });
  });

  // ─── CREATE MANIFEST ───────────────────────────────────────────────────
  describe('POST / (create manifest)', () => {
    it('creates a manifest and returns the id', async () => {
      mockInsertReturning([{ id: MANIFEST_ID }]);
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: '/', payload: createPayload });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ id: MANIFEST_ID });
      await app.close();
    });

    it('uses ownerId from apiKey, not from request body', async () => {
      mockInsertReturning([{ id: MANIFEST_ID }]);
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/',
        payload: { ...createPayload, ownerId: 'attacker_id' },
      });

      // ownerId is omitted from the create body schema, so attacker_id is stripped
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ id: MANIFEST_ID });
      await app.close();
    });

    it('returns 400 when required fields are missing', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: '/', payload: {} });

      expect(res.statusCode).toBe(400);
      await app.close();
    });

    it('returns 400 for invalid shippingMode', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/',
        payload: { ...createPayload, shippingMode: 'train' },
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });

    it('returns 402 when entitlement guard rejects', async () => {
      mocks.guardCreateManifestMock.mockResolvedValue({
        allowed: false,
        reason: 'Plan limit exceeded',
        code: 402,
      });
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: '/', payload: createPayload });

      expect(res.statusCode).toBe(402);
      await app.close();
    });
  });

  // ─── READ MANIFEST ────────────────────────────────────────────────────
  describe('GET /:id (read manifest)', () => {
    it('returns manifest when it belongs to the owner', async () => {
      mockSelectByIdReturns([sampleManifestRow]);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: `/${MANIFEST_ID}` });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ id: MANIFEST_ID, name: 'Test manifest' });
      await app.close();
    });

    it('returns 404 when manifest does not exist', async () => {
      mockSelectByIdReturns([]);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: `/${MANIFEST_ID}` });

      expect(res.statusCode).toBe(404);
      await app.close();
    });

    it('returns 400 for non-UUID id param', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/not-a-uuid' });

      expect(res.statusCode).toBe(400);
      await app.close();
    });
  });

  // ─── UPDATE MANIFEST ──────────────────────────────────────────────────
  describe('PATCH /:id (update manifest)', () => {
    it('updates manifest and returns ok', async () => {
      mockUpdateDirect();
      const app = await buildApp();
      const res = await app.inject({
        method: 'PATCH',
        url: `/${MANIFEST_ID}`,
        payload: { name: 'Updated name' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ok: true });
      await app.close();
    });

    it('returns 404 when manifest does not belong to owner', async () => {
      mocks.assertOwnsManifestMock.mockResolvedValue(false);
      const app = await buildApp();
      const res = await app.inject({
        method: 'PATCH',
        url: `/${MANIFEST_ID}`,
        payload: { name: 'Updated name' },
      });

      expect(res.statusCode).toBe(404);
      await app.close();
    });
  });

  // ─── DELETE MANIFEST ──────────────────────────────────────────────────
  describe('DELETE /:id (delete manifest)', () => {
    it('deletes manifest and returns ok', async () => {
      mockDeleteDirect();
      const app = await buildApp();
      const res = await app.inject({ method: 'DELETE', url: `/${MANIFEST_ID}` });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ok: true });
      await app.close();
    });

    it('returns 404 when manifest does not belong to owner', async () => {
      mocks.assertOwnsManifestMock.mockResolvedValue(false);
      const app = await buildApp();
      const res = await app.inject({ method: 'DELETE', url: `/${MANIFEST_ID}` });

      expect(res.statusCode).toBe(404);
      await app.close();
    });
  });

  // ─── LIST ITEMS ───────────────────────────────────────────────────────
  describe('GET /:id/items (list items)', () => {
    it('returns items for a manifest', async () => {
      mockSelectListReturns([sampleItemRow]);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: `/${MANIFEST_ID}/items` });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.items).toHaveLength(1);
      expect(json.items[0]).toMatchObject({ id: ITEM_ID });
      await app.close();
    });

    it('returns 404 when manifest does not belong to owner', async () => {
      mocks.assertOwnsManifestMock.mockResolvedValue(false);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: `/${MANIFEST_ID}/items` });

      expect(res.statusCode).toBe(404);
      await app.close();
    });

    it('passes query filters for hs6 and categoryKey', async () => {
      mockSelectListReturns([]);
      const app = await buildApp();
      const res = await app.inject({
        method: 'GET',
        url: `/${MANIFEST_ID}/items?hs6=123456&categoryKey=apparel&limit=10`,
      });

      expect(res.statusCode).toBe(200);
      await app.close();
    });
  });

  // ─── ADD ITEMS ────────────────────────────────────────────────────────
  describe('POST /:id/items (add items)', () => {
    it('adds items and returns inserted count', async () => {
      mockInsertThen(2);
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: `/${MANIFEST_ID}/items`,
        payload: {
          items: [
            {
              itemValueAmount: '100',
              itemValueCurrency: 'USD',
              dimsCm: { l: 10, w: 10, h: 10 },
              weightKg: '2',
            },
            {
              itemValueAmount: '200',
              itemValueCurrency: 'EUR',
              dimsCm: { l: 20, w: 20, h: 20 },
              weightKg: '5',
            },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ inserted: expect.any(Number) });
      await app.close();
    });

    it('returns 404 when manifest does not belong to owner', async () => {
      mocks.assertOwnsManifestMock.mockResolvedValue(false);
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: `/${MANIFEST_ID}/items`,
        payload: {
          items: [
            {
              itemValueAmount: '100',
              itemValueCurrency: 'USD',
              dimsCm: { l: 10, w: 10, h: 10 },
              weightKg: '2',
            },
          ],
        },
      });

      expect(res.statusCode).toBe(404);
      await app.close();
    });

    it('returns 400 when items array is empty', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: `/${MANIFEST_ID}/items`,
        payload: { items: [] },
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });
  });

  // ─── UPDATE ITEM ──────────────────────────────────────────────────────
  describe('PATCH /:id/items/:itemId (update item)', () => {
    it('updates item and returns ok', async () => {
      mockUpdateThen(1);
      const app = await buildApp();
      const res = await app.inject({
        method: 'PATCH',
        url: `/${MANIFEST_ID}/items/${ITEM_ID}`,
        payload: { itemValueAmount: '150' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ok: true });
      await app.close();
    });

    it('returns 404 when manifest does not belong to owner', async () => {
      mocks.assertOwnsManifestMock.mockResolvedValue(false);
      const app = await buildApp();
      const res = await app.inject({
        method: 'PATCH',
        url: `/${MANIFEST_ID}/items/${ITEM_ID}`,
        payload: { itemValueAmount: '150' },
      });

      expect(res.statusCode).toBe(404);
      await app.close();
    });

    it('returns 404 when item does not exist', async () => {
      mockUpdateThen(0);
      const app = await buildApp();
      const res = await app.inject({
        method: 'PATCH',
        url: `/${MANIFEST_ID}/items/${ITEM_ID}`,
        payload: { itemValueAmount: '150' },
      });

      expect(res.statusCode).toBe(404);
      await app.close();
    });
  });

  // ─── DELETE ITEM ──────────────────────────────────────────────────────
  describe('DELETE /:id/items/:itemId (delete item)', () => {
    it('deletes item and returns ok', async () => {
      mockDeleteThen(1);
      const app = await buildApp();
      const res = await app.inject({
        method: 'DELETE',
        url: `/${MANIFEST_ID}/items/${ITEM_ID}`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ok: true });
      await app.close();
    });

    it('returns 404 when manifest does not belong to owner', async () => {
      mocks.assertOwnsManifestMock.mockResolvedValue(false);
      const app = await buildApp();
      const res = await app.inject({
        method: 'DELETE',
        url: `/${MANIFEST_ID}/items/${ITEM_ID}`,
      });

      expect(res.statusCode).toBe(404);
      await app.close();
    });

    it('returns 404 when item does not exist', async () => {
      mockDeleteThen(0);
      const app = await buildApp();
      const res = await app.inject({
        method: 'DELETE',
        url: `/${MANIFEST_ID}/items/${ITEM_ID}`,
      });

      expect(res.statusCode).toBe(404);
      await app.close();
    });
  });
});
