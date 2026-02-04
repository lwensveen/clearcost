import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import {
  canonicalInternalBody,
  computeInternalSignature,
  internalBodyHash,
} from '../../lib/internal-signing.js';

const originalEnv = { ...process.env };

vi.mock('drizzle-orm', () => ({
  eq: () => ({ type: 'eq' }),
  and: () => ({ type: 'and' }),
}));

vi.mock('@clearcost/db', () => ({
  apiKeysTable: {},
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => undefined,
      }),
    }),
  },
}));

beforeEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
});

async function registerPlugin() {
  const app = Fastify();
  await app.register(sensible);
  const { apiKeyAuthPlugin } = await import('../api-key-auth.js');
  try {
    await app.register(apiKeyAuthPlugin);
  } finally {
    await app.close();
  }
}

describe('api-key-auth production env guards', () => {
  it('fails in production when API_KEY_PEPPER is missing', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.API_KEY_PEPPER;
    process.env.INTERNAL_SIGNING_SECRET = 'secret';

    await expect(registerPlugin()).rejects.toThrow('API_KEY_PEPPER must be set in production');
  });

  it('fails in production when INTERNAL_SIGNING_SECRET is missing', async () => {
    process.env.NODE_ENV = 'production';
    process.env.API_KEY_PEPPER = 'pepper';
    delete process.env.INTERNAL_SIGNING_SECRET;

    await expect(registerPlugin()).rejects.toThrow(
      'INTERNAL_SIGNING_SECRET must be set in production'
    );
  });

  it('does not enforce those vars outside production', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.API_KEY_PEPPER;
    delete process.env.INTERNAL_SIGNING_SECRET;

    await expect(registerPlugin()).resolves.toBeUndefined();
  });

  it('skips signature verification when INTERNAL_SIGNING_SECRET is unset in non-production', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.INTERNAL_SIGNING_SECRET;
    delete process.env.API_KEY_PEPPER;

    const app = Fastify();
    await app.register(sensible);
    const { apiKeyAuthPlugin } = await import('../api-key-auth.js');
    await app.register(apiKeyAuthPlugin);

    app.post('/internal', { preHandler: app.requireInternalSignature() }, async () => ({
      ok: true,
    }));
    const res = await app.inject({ method: 'POST', url: '/internal', payload: { x: 1 } });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('supports internal signature verification when req.url is missing but raw.url/query are present', async () => {
    process.env.NODE_ENV = 'test';
    process.env.API_KEY_PEPPER = 'pepper';
    process.env.INTERNAL_SIGNING_SECRET = 'sign-secret';

    const app = Fastify();
    await app.register(sensible);
    const { apiKeyAuthPlugin } = await import('../api-key-auth.js');
    await app.register(apiKeyAuthPlugin);

    const hook = app.requireInternalSignature();
    const ts = String(Date.now());
    const body = { ping: 'pong' };
    const canonicalPath = '/internal/task?a=1&b=2';
    const sig = computeInternalSignature({
      ts,
      method: 'GET',
      path: canonicalPath,
      bodyHash: internalBodyHash(canonicalInternalBody(body)),
      secret: process.env.INTERNAL_SIGNING_SECRET!,
    });

    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    } as any;
    const req = {
      method: undefined,
      body,
      headers: { 'x-cc-ts': ts, 'x-cc-sig': sig },
      query: { a: '1', b: '2' },
      raw: { url: '/internal/task?b=2&a=1' },
    } as any;

    await hook.call(app, req, reply, () => {});
    expect(reply.code).not.toHaveBeenCalled();
    await app.close();
  });

  it('handles optional API key hooks when authorization header is an array', async () => {
    process.env.NODE_ENV = 'test';
    process.env.API_KEY_PEPPER = 'pepper';
    process.env.INTERNAL_SIGNING_SECRET = 'sign-secret';

    const app = Fastify();
    await app.register(sensible);
    const { apiKeyAuthPlugin } = await import('../api-key-auth.js');
    await app.register(apiKeyAuthPlugin);

    const hook = app.requireApiKey([], { optional: true });
    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    } as any;
    const req = {
      headers: { authorization: ['Bearer not-a-clearcost-token'] },
    } as any;

    await hook.call(app, req, reply, () => {});
    expect(reply.code).not.toHaveBeenCalled();
    await app.close();
  });
});
