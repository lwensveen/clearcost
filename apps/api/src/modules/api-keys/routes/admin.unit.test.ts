import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Valid v4 UUIDs (version nibble = 4, variant nibble = a)
const OWNER_ID = 'a1a1a1a1-a1a1-4a1a-aa1a-a1a1a1a1a1a1';
const KEY_ID_UUID = 'b2b2b2b2-b2b2-4b2b-ab2b-b2b2b2b2b2b2';

const mocks = vi.hoisted(() => ({
  selectMock: vi.fn(),
  insertMock: vi.fn(),
  updateMock: vi.fn(),
  generateApiKeyMock: vi.fn(),
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

vi.mock('../../../plugins/api-key-auth.js', () => ({
  generateApiKey: mocks.generateApiKeyMock,
}));

import apiKeyAdminRoutes from './admin.js';

const now = new Date('2025-06-01T00:00:00.000Z');

const sampleKey = {
  id: KEY_ID_UUID,
  keyId: 'k_abc123',
  prefix: 'live',
  ownerId: OWNER_ID,
  name: 'My API Key',
  scopes: ['quotes:read'],
  isActive: true,
  expiresAt: null,
  revokedAt: null,
  createdAt: now,
  lastUsedAt: null,
};

function mockListRows(rows: unknown[]) {
  mocks.selectMock.mockReturnValueOnce({
    from: () => ({
      where: () => ({
        limit: async () => rows,
      }),
    }),
  });
}

function mockGetById(row: unknown | null) {
  mocks.selectMock.mockReturnValueOnce({
    from: () => ({
      where: () => ({
        limit: async () => (row ? [row] : []),
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

async function buildApp() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('requireApiKey', () => async (req: any) => {
    req.apiKey = { id: 'api_1', ownerId: OWNER_ID };
  });
  await app.register(apiKeyAdminRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.generateApiKeyMock.mockResolvedValue({
    token: 'ck_live_abc.secret123',
    keyId: 'k_new',
    tokenPhc: '$scrypt$...',
    prefix: 'live',
  });
});

describe('api-key admin routes', () => {
  // ─── GET / ────────────────────────────────────────────────
  describe('GET /', () => {
    it('lists keys for the given ownerId', async () => {
      mockListRows([sampleKey]);
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: `/?ownerId=${OWNER_ID}`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        id: KEY_ID_UUID,
        ownerId: OWNER_ID,
        name: 'My API Key',
        isActive: true,
      });
      await app.close();
    });

    it('returns empty array when no keys exist', async () => {
      mockListRows([]);
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: `/?ownerId=${OWNER_ID}`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
      await app.close();
    });

    it('returns 400 when ownerId is missing', async () => {
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });

    it('returns 400 when ownerId is not a valid UUID', async () => {
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/?ownerId=invalid',
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });
  });

  // ─── POST / ───────────────────────────────────────────────
  describe('POST /', () => {
    it('creates a new API key and returns plaintext token', async () => {
      mockInsertReturning({ id: KEY_ID_UUID, createdAt: now });
      const app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/',
        payload: {
          ownerId: OWNER_ID,
          name: 'New Key',
          scopes: ['quotes:read'],
          prefix: 'live',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.token).toBe('ck_live_abc.secret123');
      expect(body.ownerId).toBe(OWNER_ID);
      expect(body.name).toBe('New Key');
      expect(mocks.generateApiKeyMock).toHaveBeenCalledWith('live');
      await app.close();
    });

    it('returns 500 when insert fails', async () => {
      mockInsertReturning(null);
      const app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/',
        payload: {
          ownerId: OWNER_ID,
          name: 'Broken Key',
        },
      });

      expect(res.statusCode).toBe(500);
      await app.close();
    });

    it('returns 400 when name is missing', async () => {
      const app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/',
        payload: { ownerId: OWNER_ID },
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });
  });

  // ─── GET /:id ─────────────────────────────────────────────
  describe('GET /:id', () => {
    it('returns a single key by id', async () => {
      mockGetById(sampleKey);
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: `/${KEY_ID_UUID}`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        id: KEY_ID_UUID,
        name: 'My API Key',
      });
      await app.close();
    });

    it('returns 404 when key does not exist', async () => {
      mockGetById(null);
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: `/${KEY_ID_UUID}`,
      });

      expect(res.statusCode).toBe(404);
      await app.close();
    });

    it('returns 400 when id is not a valid UUID', async () => {
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/not-valid',
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });
  });

  // ─── PATCH /:id ───────────────────────────────────────────
  describe('PATCH /:id', () => {
    it('deactivates a key', async () => {
      mockUpdateReturning({
        id: KEY_ID_UUID,
        isActive: false,
        revokedAt: null,
        updatedAt: now,
      });
      const app = await buildApp();

      const res = await app.inject({
        method: 'PATCH',
        url: `/${KEY_ID_UUID}`,
        payload: { isActive: false },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ id: KEY_ID_UUID, isActive: false });
      await app.close();
    });

    it('reactivates a key', async () => {
      mockUpdateReturning({
        id: KEY_ID_UUID,
        isActive: true,
        revokedAt: null,
        updatedAt: now,
      });
      const app = await buildApp();

      const res = await app.inject({
        method: 'PATCH',
        url: `/${KEY_ID_UUID}`,
        payload: { isActive: true },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ id: KEY_ID_UUID, isActive: true });
      await app.close();
    });

    it('revokes a key', async () => {
      mockUpdateReturning({
        id: KEY_ID_UUID,
        isActive: false,
        revokedAt: now,
        updatedAt: now,
      });
      const app = await buildApp();

      const res = await app.inject({
        method: 'PATCH',
        url: `/${KEY_ID_UUID}`,
        payload: { revoke: true },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().revokedAt).toBeDefined();
      await app.close();
    });

    it('returns 404 when key does not exist', async () => {
      mockUpdateReturning(null);
      const app = await buildApp();

      const res = await app.inject({
        method: 'PATCH',
        url: `/${KEY_ID_UUID}`,
        payload: { isActive: false },
      });

      expect(res.statusCode).toBe(404);
      await app.close();
    });

    it('returns 400 when id is not a valid UUID', async () => {
      const app = await buildApp();

      const res = await app.inject({
        method: 'PATCH',
        url: '/not-valid',
        payload: { isActive: false },
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });
  });

  // ─── POST /:id/rotate ────────────────────────────────────
  describe('POST /:id/rotate', () => {
    it('rotates a key and returns the new plaintext token', async () => {
      // First select to fetch current key
      mockGetById(sampleKey);
      // Then insert the new rotated key
      mockInsertReturning({ id: 'd4d4d4d4-d4d4-4d4d-ad4d-d4d4d4d4d4d4', createdAt: now });
      const app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: `/${KEY_ID_UUID}/rotate`,
        payload: {},
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.token).toBe('ck_live_abc.secret123');
      await app.close();
    });

    it('returns 404 when key to rotate does not exist', async () => {
      mockGetById(null);
      const app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: `/${KEY_ID_UUID}/rotate`,
        payload: {},
      });

      expect(res.statusCode).toBe(404);
      await app.close();
    });
  });

  // ─── GET /:id/reveal ─────────────────────────────────────
  describe('GET /:id/reveal', () => {
    it('always returns 400 because secrets cannot be retrieved', async () => {
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: `/${KEY_ID_UUID}/reveal`,
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });
  });

  // ─── Auth enforcement ─────────────────────────────────────
  describe('auth enforcement', () => {
    it('registers all routes with admin:api-keys scope', async () => {
      const requireApiKeyMock = vi.fn((_scopes?: string[]) => async () => {}) as any;
      const app = Fastify().withTypeProvider<ZodTypeProvider>();
      app.setValidatorCompiler(validatorCompiler);
      app.setSerializerCompiler(serializerCompiler);
      app.decorate('requireApiKey', requireApiKeyMock);
      await app.register(apiKeyAdminRoutes);

      const calls = requireApiKeyMock.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        expect(call[0]).toEqual(['admin:api-keys']);
      }
      await app.close();
    });
  });
});
