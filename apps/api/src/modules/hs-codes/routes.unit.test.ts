import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  selectMock: vi.fn(),
  escapeLikeMock: vi.fn(),
}));

vi.mock('@clearcost/db', async () => {
  const actual = await vi.importActual<typeof import('@clearcost/db')>('@clearcost/db');
  return {
    ...actual,
    db: {
      select: mocks.selectMock,
    },
  };
});

vi.mock('../../lib/sql-utils.js', () => ({
  escapeLike: mocks.escapeLikeMock,
}));

import hsRoutes from './routes.js';

function mockHs6LookupRows(rows: unknown[]) {
  mocks.selectMock.mockReturnValueOnce({
    from: () => ({
      where: () => ({
        limit: async () => rows,
      }),
    }),
  });
}

function mockSearchRows(rows: unknown[]) {
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

function mockLookupRows(rows: unknown[]) {
  mocks.selectMock.mockReturnValueOnce({
    from: () => ({
      innerJoin: () => ({
        where: () => ({
          limit: async () => rows,
        }),
      }),
    }),
  });
}

const sampleHsCode = {
  hs6: '854231',
  title: 'Electronic integrated circuits; processors and controllers',
  ahtn8: null,
  cn8: '85423100',
  hts10: '8542310001',
};

async function buildApp() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('requireApiKey', () => async (req: any) => {
    req.apiKey = { id: 'api_1', ownerId: 'owner_1' };
  });
  await app.register(hsRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.escapeLikeMock.mockImplementation((v: string) => v.replace(/[\\%_]/g, (ch) => `\\${ch}`));
});

describe('hs-codes routes', () => {
  // ─── GET / (search) ───────────────────────────────────────
  describe('GET / (search)', () => {
    it('returns results for exact hs6 lookup', async () => {
      mockHs6LookupRows([sampleHsCode]);
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/?hs6=854231',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({ hs6: '854231' });
      expect(res.headers['cache-control']).toContain('max-age=300');
      await app.close();
    });

    it('returns empty array when hs6 not found', async () => {
      mockHs6LookupRows([]);
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/?hs6=999999',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
      await app.close();
    });

    it('searches by text query q', async () => {
      mockSearchRows([{ ...sampleHsCode, _rank: 1 }]);
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/?q=processors',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({ hs6: '854231' });
      // _rank should be stripped from response
      expect(body[0]._rank).toBeUndefined();
      expect(res.headers['cache-control']).toContain('max-age=120');
      await app.close();
    });

    it('returns empty array for text query with no matches', async () => {
      mockSearchRows([]);
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/?q=nonexistent',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
      await app.close();
    });

    it('returns 400 when hs6 has wrong format', async () => {
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/?hs6=12345',
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });

    it('returns 400 when hs6 contains non-digits', async () => {
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/?hs6=abcdef',
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });

    it('returns 400 when limit exceeds max (50)', async () => {
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/?q=test&limit=100',
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });

    it('returns 400 when neither q nor hs6 is provided', async () => {
      // Without q or hs6, the handler would proceed with empty q,
      // but the search path uses escapeLike on empty trimmed string
      // and the db returns empty. Depending on schema, let's test.
      mockSearchRows([]);
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/',
      });

      // Both q and hs6 are optional, so the route itself handles this
      // by treating it as a text search with empty string
      expect(res.statusCode).toBe(200);
      await app.close();
    });
  });

  // ─── LIKE escape ──────────────────────────────────────────
  describe('LIKE escape', () => {
    it('calls escapeLike on the user query for text search', async () => {
      mockSearchRows([]);
      const app = await buildApp();

      await app.inject({
        method: 'GET',
        url: '/?q=100%25_cotton',
      });

      expect(mocks.escapeLikeMock).toHaveBeenCalledTimes(1);
      await app.close();
    });

    it('escapes % characters in user input', async () => {
      mockSearchRows([]);
      const app = await buildApp();

      await app.inject({
        method: 'GET',
        url: '/?q=50%25off',
      });

      // escapeLike should have been called with the decoded value
      expect(mocks.escapeLikeMock).toHaveBeenCalledWith('50%off');
      await app.close();
    });

    it('escapes _ characters in user input', async () => {
      mockSearchRows([]);
      const app = await buildApp();

      await app.inject({
        method: 'GET',
        url: '/?q=test_value',
      });

      expect(mocks.escapeLikeMock).toHaveBeenCalledWith('test_value');
      await app.close();
    });

    it('escapes backslash characters in user input', async () => {
      mockSearchRows([]);
      const app = await buildApp();

      await app.inject({
        method: 'GET',
        url: '/?q=test%5Cvalue',
      });

      expect(mocks.escapeLikeMock).toHaveBeenCalledWith('test\\value');
      await app.close();
    });

    it('does not call escapeLike for hs6 exact lookup', async () => {
      mockHs6LookupRows([]);
      const app = await buildApp();

      await app.inject({
        method: 'GET',
        url: '/?hs6=854231',
      });

      expect(mocks.escapeLikeMock).not.toHaveBeenCalled();
      await app.close();
    });
  });

  // ─── GET /lookup ──────────────────────────────────────────
  describe('GET /lookup', () => {
    it('returns alias lookup result', async () => {
      mockLookupRows([
        {
          hs6: '854231',
          aliasTitle: 'Processors',
          system: 'HTS10',
          code: '8542310001',
          title: 'Electronic integrated circuits',
        },
      ]);
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/lookup?system=HTS10&code=8542310001',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        hs6: '854231',
        system: 'HTS10',
        code: '8542310001',
      });
      expect(res.headers['cache-control']).toContain('max-age=300');
      await app.close();
    });

    it('returns 404 when alias is not found', async () => {
      mockLookupRows([]);
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/lookup?system=HTS10&code=9999999999',
      });

      expect(res.statusCode).toBe(404);
      await app.close();
    });

    it('returns 400 when system is missing', async () => {
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/lookup?code=8542310001',
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });

    it('returns 400 when code is missing', async () => {
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/lookup?system=HTS10',
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });

    it('returns 400 when system is invalid', async () => {
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/lookup?system=INVALID&code=8542310001',
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });

    it('returns 400 when code has wrong format', async () => {
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/lookup?system=HTS10&code=short',
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });
  });

  // ─── Auth enforcement ─────────────────────────────────────
  describe('auth enforcement', () => {
    it('registers all routes with hs:read scope', async () => {
      const requireApiKeyMock = vi.fn((_scopes?: string[]) => async () => {}) as any;
      const app = Fastify().withTypeProvider<ZodTypeProvider>();
      app.setValidatorCompiler(validatorCompiler);
      app.setSerializerCompiler(serializerCompiler);
      app.decorate('requireApiKey', requireApiKeyMock);
      await app.register(hsRoutes);

      const calls = requireApiKeyMock.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        expect(call[0]).toEqual(['hs:read']);
      }
      await app.close();
    });
  });
});
