import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Valid v4 UUIDs (version nibble = 4, variant nibble = a)
const OWNER_ID = 'a1a1a1a1-a1a1-4a1a-aa1a-a1a1a1a1a1a1';
const ENDPOINT_ID = 'b2b2b2b2-b2b2-4b2b-ab2b-b2b2b2b2b2b2';
const DELIVERY_ID = 'c3c3c3c3-c3c3-4c3c-ac3c-c3c3c3c3c3c3';

const mocks = vi.hoisted(() => ({
  selectMock: vi.fn(),
  insertMock: vi.fn(),
  updateMock: vi.fn(),
  encryptSecretMock: vi.fn(),
}));

vi.mock('@clearcost/db', async () => {
  const actual = await vi.importActual<typeof import('@clearcost/db')>('@clearcost/db');
  return {
    ...actual,
    db: {
      select: mocks.selectMock,
      insert: mocks.insertMock,
      update: mocks.updateMock,
    },
  };
});

vi.mock('../services/secret-kms.js', () => ({
  encryptSecret: mocks.encryptSecretMock,
}));

import webhookAdminRoutes from './routes.js';

function mockListRows(rows: unknown[]) {
  mocks.selectMock.mockReturnValueOnce({
    from: () => ({
      where: () => ({
        limit: async () => rows,
      }),
    }),
  });
}

function mockInsertReturning(row: unknown | null) {
  mocks.insertMock.mockReturnValueOnce({
    values: () => ({
      returning: async () => (row ? [row] : []),
    }),
  });
}

function mockUpdateReturning(row: unknown | null) {
  mocks.updateMock.mockReturnValueOnce({
    set: () => ({
      where: () => ({
        returning: async () => (row ? [row] : []),
      }),
    }),
  });
}

function mockDeliveryList(rows: unknown[]) {
  mocks.selectMock.mockReturnValueOnce({
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: async () => rows,
        }),
      }),
    }),
  });
}

const sampleEndpoint = {
  id: ENDPOINT_ID,
  ownerId: OWNER_ID,
  url: 'https://example.com/hooks',
  events: ['quote.created'],
  isActive: true,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: null,
};

async function buildApp() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('requireApiKey', () => async (req: any) => {
    req.apiKey = { id: 'api_1', ownerId: OWNER_ID };
  });
  await app.register(webhookAdminRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.encryptSecretMock.mockReturnValue({
    encB64u: 'enc123',
    ivB64u: 'iv123',
    tagB64u: 'tag123',
  });
});

describe('webhook admin routes', () => {
  // ─── GET /endpoints ───────────────────────────────────────
  describe('GET /endpoints', () => {
    it('returns endpoints for the given ownerId', async () => {
      mockListRows([sampleEndpoint]);
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: `/endpoints?ownerId=${OWNER_ID}`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        id: ENDPOINT_ID,
        ownerId: OWNER_ID,
        url: 'https://example.com/hooks',
        isActive: true,
      });
      await app.close();
    });

    it('returns empty array when no endpoints exist', async () => {
      mockListRows([]);
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: `/endpoints?ownerId=${OWNER_ID}`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
      await app.close();
    });

    it('returns 400 when ownerId is missing', async () => {
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/endpoints',
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });

    it('returns 400 when ownerId is not a valid UUID', async () => {
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/endpoints?ownerId=not-a-uuid',
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });
  });

  // ─── POST /endpoints ──────────────────────────────────────
  describe('POST /endpoints', () => {
    it('creates a webhook endpoint and returns secret', async () => {
      mockInsertReturning(sampleEndpoint);
      const app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/endpoints',
        payload: {
          ownerId: OWNER_ID,
          url: 'https://example.com/hooks',
          events: ['quote.created'],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body).toMatchObject({
        id: ENDPOINT_ID,
        ownerId: OWNER_ID,
        url: 'https://example.com/hooks',
      });
      expect(body.secret).toBeDefined();
      expect(mocks.encryptSecretMock).toHaveBeenCalledTimes(1);
      await app.close();
    });

    it('returns 500 when insert fails to return a row', async () => {
      mockInsertReturning(null);
      const app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/endpoints',
        payload: {
          ownerId: OWNER_ID,
          url: 'https://example.com/hooks',
          events: [],
        },
      });

      expect(res.statusCode).toBe(500);
      await app.close();
    });

    it('returns 400 when URL is missing', async () => {
      const app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/endpoints',
        payload: { ownerId: OWNER_ID },
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });

    it('returns 400 when ownerId is not a valid UUID', async () => {
      const app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/endpoints',
        payload: {
          ownerId: 'bad',
          url: 'https://example.com/hooks',
        },
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });
  });

  // ─── POST /endpoints/:id/rotate ───────────────────────────
  describe('POST /endpoints/:id/rotate', () => {
    it('rotates the secret for an endpoint', async () => {
      mockUpdateReturning({ id: ENDPOINT_ID });
      const app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: `/endpoints/${ENDPOINT_ID}/rotate`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe(ENDPOINT_ID);
      expect(body.secret).toBeDefined();
      await app.close();
    });

    it('returns 404 when endpoint does not exist', async () => {
      mockUpdateReturning(null);
      const app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: `/endpoints/${ENDPOINT_ID}/rotate`,
      });

      expect(res.statusCode).toBe(404);
      await app.close();
    });

    it('returns 400 when id is not a valid UUID', async () => {
      const app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/endpoints/not-a-uuid/rotate',
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });
  });

  // ─── PATCH /endpoints/:id ─────────────────────────────────
  describe('PATCH /endpoints/:id', () => {
    it('deactivates an endpoint', async () => {
      mockUpdateReturning({ id: ENDPOINT_ID, isActive: false });
      const app = await buildApp();

      const res = await app.inject({
        method: 'PATCH',
        url: `/endpoints/${ENDPOINT_ID}`,
        payload: { isActive: false },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ id: ENDPOINT_ID, isActive: false });
      await app.close();
    });

    it('activates an endpoint', async () => {
      mockUpdateReturning({ id: ENDPOINT_ID, isActive: true });
      const app = await buildApp();

      const res = await app.inject({
        method: 'PATCH',
        url: `/endpoints/${ENDPOINT_ID}`,
        payload: { isActive: true },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ id: ENDPOINT_ID, isActive: true });
      await app.close();
    });

    it('returns 404 when endpoint does not exist', async () => {
      mockUpdateReturning(null);
      const app = await buildApp();

      const res = await app.inject({
        method: 'PATCH',
        url: `/endpoints/${ENDPOINT_ID}`,
        payload: { isActive: false },
      });

      expect(res.statusCode).toBe(404);
      await app.close();
    });

    it('returns 400 when isActive is not a boolean', async () => {
      const app = await buildApp();

      const res = await app.inject({
        method: 'PATCH',
        url: `/endpoints/${ENDPOINT_ID}`,
        payload: { isActive: 'yes' },
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });

    it('returns 400 when body is empty', async () => {
      const app = await buildApp();

      const res = await app.inject({
        method: 'PATCH',
        url: `/endpoints/${ENDPOINT_ID}`,
        payload: {},
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });
  });

  // ─── GET /deliveries ──────────────────────────────────────
  describe('GET /deliveries', () => {
    it('returns delivery log for an endpoint', async () => {
      const delivery = {
        id: DELIVERY_ID,
        endpointId: ENDPOINT_ID,
        event: 'quote.created',
        payload: {},
        attempt: 1,
        status: 'delivered',
        responseStatus: 200,
        responseBody: null,
        deliveredAt: new Date('2025-01-02T00:00:00.000Z'),
        nextAttemptAt: null,
        createdAt: new Date('2025-01-02T00:00:00.000Z'),
        updatedAt: null,
      };
      mockDeliveryList([delivery]);
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: `/deliveries?endpointId=${ENDPOINT_ID}`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
      await app.close();
    });

    it('returns 400 when endpointId is missing', async () => {
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/deliveries',
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });
  });

  // ─── Auth enforcement ─────────────────────────────────────
  describe('auth enforcement', () => {
    it('registers all routes with admin:webhooks scope', async () => {
      const requireApiKeyMock = vi.fn((_scopes?: string[]) => async () => {}) as any;
      const app = Fastify().withTypeProvider<ZodTypeProvider>();
      app.setValidatorCompiler(validatorCompiler);
      app.setSerializerCompiler(serializerCompiler);
      app.decorate('requireApiKey', requireApiKeyMock);
      await app.register(webhookAdminRoutes);

      // All routes in this module require admin:webhooks
      const calls = requireApiKeyMock.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        expect(call[0]).toEqual(['admin:webhooks']);
      }
      await app.close();
    });
  });
});
