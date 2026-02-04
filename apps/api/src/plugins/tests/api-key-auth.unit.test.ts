import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { apiKeyAuthPlugin, generateApiKey } from '../api-key-auth.js';
import sensible from '@fastify/sensible';
import {
  canonicalInternalBody,
  computeInternalSignature,
  internalBodyHash,
} from '../../lib/internal-signing.js';

const { resetEnv } = vi.hoisted(() => {
  const OLD = { ...process.env };
  process.env.API_KEY_PEPPER = 'pepper-xyz';
  process.env.INTERNAL_SIGNING_SECRET = 'internal-secret-123';
  return {
    resetEnv: () => {
      process.env = { ...OLD };
    },
  };
});

type Row = {
  id: string;
  ownerId: string;
  keyId: string;
  tokenPhc: string;
  prefix: 'live' | 'test' | string;
  isActive: boolean;
  scopes: string[];
  allowedOrigins: string[];
  expiresAt?: Date | null;
  revokedAt?: Date | null;
  lastUsedAt?: Date | null;
};
type Pred = { type: 'eq'; left: string; right: any } | { type: 'and'; conds: Pred[] };

const { dbState } = vi.hoisted(() => ({
  dbState: { rows: [] as Row[] },
}));

vi.mock('drizzle-orm', () => {
  return {
    eq: (left: any, right: any) => ({ type: 'eq', left, right }) as Pred,
    and: (...conds: Pred[]) => ({ type: 'and', conds }) as Pred,
  };
});

function evalPred(pred: Pred, row: Row): boolean {
  if (pred.type === 'eq') return (row as any)[pred.left] === pred.right;
  return pred.conds.every((p) => evalPred(p, row));
}

vi.mock('@clearcost/db', () => {
  const apiKeysTable = {
    id: 'id',
    ownerId: 'ownerId',
    keyId: 'keyId',
    tokenPhc: 'tokenPhc', // updated schema
    prefix: 'prefix',
    isActive: 'isActive',
    scopes: 'scopes',
    allowedOrigins: 'allowedOrigins',
    expiresAt: 'expiresAt',
    revokedAt: 'revokedAt',
    lastUsedAt: 'lastUsedAt',
  } as const;

  const db = {
    select: () => ({
      from: (_tbl: any) => ({
        where: (pred: Pred) => ({
          limit: async (n: number) => dbState.rows.filter((r) => evalPred(pred, r)).slice(0, n),
        }),
      }),
    }),
    update: () => ({
      set: (_vals: Partial<Row>) => ({
        where: (_pred: Pred) => Promise.resolve(),
      }),
    }),
  };

  return { db, apiKeysTable, __state: dbState };
});

async function makeApp() {
  const app = Fastify();
  await app.register(sensible);
  await app.register(apiKeyAuthPlugin);

  app.get('/private', { preHandler: app.requireApiKey(['read:things']) }, async (req) => ({
    ok: true,
    principal: req.apiKey,
  }));

  app.get('/optional', { preHandler: app.requireApiKey([], { optional: true }) }, async (req) => ({
    ok: true,
    authed: !!req.apiKey,
  }));

  app.get('/auth-any', { preHandler: app.requireApiKey([]) }, async (req) => ({
    ok: true,
    authed: !!req.apiKey,
  }));

  app.get(
    '/owner',
    { preHandler: app.requireApiKey([], { ownerFrom: (r) => r.headers['x-owner-id'] as string }) },
    async () => ({ ok: true })
  );

  app.get('/origin', { preHandler: app.requireApiKey([]) }, async () => ({ ok: true }));

  app.post(
    '/internal/task',
    { preHandler: app.requireApiKey([], { internalSigned: true, optional: true }) },
    async () => ({ ok: true })
  );

  app.post('/internal/strict', { preHandler: app.requireInternalSignature() }, async () => ({
    ok: true,
  }));

  return app;
}

function bearer(token: string) {
  return { authorization: `Bearer ${token}` };
}

function signInternal(ts: number, method: string, url: string, body: unknown, secret: string) {
  const bodyStr = canonicalInternalBody(body);
  const bodyHash = internalBodyHash(bodyStr);
  const sig = computeInternalSignature({
    ts: String(ts),
    method,
    path: url,
    bodyHash,
    secret,
  });
  return { 'x-cc-ts': String(ts), 'x-cc-sig': sig };
}

async function seedKey({
  prefix = 'test' as 'test' | 'live',
  scopes = ['read:things'] as string[],
  allowedOrigins = [] as string[],
  isActive = true,
  expiresAt = null as Date | null,
  revokedAt = null as Date | null,
  ownerId = 'owner-1',
} = {}) {
  const { token, keyId, tokenPhc, prefix: px } = await generateApiKey(prefix);
  dbState.rows.push({
    id: `id-${keyId}`,
    ownerId,
    keyId,
    tokenPhc,
    prefix: px,
    isActive,
    scopes,
    allowedOrigins,
    expiresAt: expiresAt ?? undefined,
    revokedAt: revokedAt ?? undefined,
  });
  return { token, keyId, prefix: px, ownerId };
}

describe('apiKeyAuthPlugin (unit, DB mocked)', () => {
  beforeEach(() => {
    process.env.API_KEY_PEPPER = 'pepper-xyz';
    process.env.INTERNAL_SIGNING_SECRET = 'internal-secret-123';
    dbState.rows.length = 0;
  });

  afterEach(() => {
    resetEnv();
  });

  it('401 when missing key', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/private' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('200 with valid key and principal attached', async () => {
    const { token } = await seedKey();
    const app = await makeApp();
    const r = await app.inject({ method: 'GET', url: '/private', headers: bearer(token) });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ ok: true, principal: { ownerId: 'owner-1' } });
    await app.close();
  });

  it('optional route allows anonymous', async () => {
    const app = await makeApp();
    const r = await app.inject({ method: 'GET', url: '/optional' });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true, authed: false });
    await app.close();
  });

  it('optional route ignores malformed keys and remains anonymous', async () => {
    const app = await makeApp();
    const r = await app.inject({
      method: 'GET',
      url: '/optional',
      headers: { authorization: 'Bearer not-a-clearcost-token' },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true, authed: false });
    await app.close();
  });

  it('401 for inactive / expired / revoked', async () => {
    const app = await makeApp();

    const { token: t1 } = await seedKey({ isActive: false });
    expect(
      (await app.inject({ method: 'GET', url: '/private', headers: bearer(t1) })).statusCode
    ).toBe(401);

    const { token: t2 } = await seedKey({ expiresAt: new Date(Date.now() - 60_000) });
    expect(
      (await app.inject({ method: 'GET', url: '/private', headers: bearer(t2) })).statusCode
    ).toBe(401);

    const { token: t3 } = await seedKey({ revokedAt: new Date() });
    expect(
      (await app.inject({ method: 'GET', url: '/private', headers: bearer(t3) })).statusCode
    ).toBe(401);

    await app.close();
  });

  it('401 on prefix mismatch', async () => {
    const { token } = await seedKey({ prefix: 'test' });
    const liveToken = token.replace(/^ck_test_/, 'ck_live_'); // mismatched
    const app = await makeApp();
    const r = await app.inject({ method: 'GET', url: '/private', headers: bearer(liveToken) });
    expect(r.statusCode).toBe(401);
    await app.close();
  });

  it('accepts token via x-api-key header', async () => {
    const { token } = await seedKey();
    const app = await makeApp();
    const r = await app.inject({ method: 'GET', url: '/private', headers: { 'x-api-key': token } });
    expect(r.statusCode).toBe(200);
    await app.close();
  });

  it('accepts authorization header when provided as an array value', async () => {
    const { token } = await seedKey();
    const app = await makeApp();
    const r = await app.inject({
      method: 'GET',
      url: '/auth-any',
      headers: { authorization: [`Bearer ${token}`] as any },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ ok: true, authed: true });
    await app.close();
  });

  it('accepts x-api-key header when provided as an array value', async () => {
    const { token } = await seedKey();
    const app = await makeApp();
    const r = await app.inject({
      method: 'GET',
      url: '/auth-any',
      headers: { 'x-api-key': [token] as any },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ ok: true, authed: true });
    await app.close();
  });

  it('403 when missing required scope', async () => {
    const { token } = await seedKey({ scopes: ['read:other'] });
    const app = await makeApp();
    const r = await app.inject({ method: 'GET', url: '/private', headers: bearer(token) });
    expect(r.statusCode).toBe(403);
    await app.close();
  });

  it('ABAC owner check: 403 mismatch, 200 match', async () => {
    const { token } = await seedKey({ ownerId: 'owner-1' });
    const app = await makeApp();

    const bad = await app.inject({
      method: 'GET',
      url: '/owner',
      headers: { ...bearer(token), 'x-owner-id': 'owner-2' },
    });
    expect(bad.statusCode).toBe(403);

    const ok = await app.inject({
      method: 'GET',
      url: '/owner',
      headers: { ...bearer(token), 'x-owner-id': 'owner-1' },
    });
    expect(ok.statusCode).toBe(200);

    await app.close();
  });

  it('Origin allowlist enforced; admin bypass', async () => {
    const { token } = await seedKey({ allowedOrigins: ['https://a.example'] });
    const app = await makeApp();

    const blocked = await app.inject({
      method: 'GET',
      url: '/origin',
      headers: { ...bearer(token), origin: 'https://b.example' },
    });
    expect(blocked.statusCode).toBe(403);

    const allowed = await app.inject({
      method: 'GET',
      url: '/origin',
      headers: { ...bearer(token), origin: 'https://a.example' },
    });
    expect(allowed.statusCode).toBe(200);

    const { token: adminToken } = await seedKey({ scopes: ['admin:all'] });
    const bypass = await app.inject({
      method: 'GET',
      url: '/origin',
      headers: { ...bearer(adminToken), origin: 'https://nope.example' },
    });
    expect(bypass.statusCode).toBe(200);

    await app.close();
  });

  it('internalSigned: 401 bad/missing, 200 valid', async () => {
    const app = await makeApp();
    const url = '/internal/task?x=1';
    const body = { hello: 'world' };
    const ts = Date.now();
    const secret = process.env.INTERNAL_SIGNING_SECRET!;

    const missing = await app.inject({ method: 'POST', url, payload: body });
    expect(missing.statusCode).toBe(401);

    const bad = await app.inject({
      method: 'POST',
      url,
      payload: body,
      headers: { 'x-cc-ts': String(ts), 'x-cc-sig': 'deadbeef' },
    });
    expect(bad.statusCode).toBe(401);

    const old = await app.inject({
      method: 'POST',
      url,
      payload: body,
      headers: signInternal(ts - 10 * 60 * 1000, 'POST', url, body, secret),
    });
    expect(old.statusCode).toBe(401);

    const ok = await app.inject({
      method: 'POST',
      url,
      payload: body,
      headers: signInternal(ts, 'POST', url, body, secret),
    });
    expect(ok.statusCode).toBe(200);

    await app.close();
  });

  it('requireInternalSignature decorator enforces signed requests', async () => {
    const app = await makeApp();
    const url = '/internal/strict?x=1';
    const body = { ping: 'pong' };
    const ts = Date.now();
    const secret = process.env.INTERNAL_SIGNING_SECRET!;

    const missing = await app.inject({ method: 'POST', url, payload: body });
    expect(missing.statusCode).toBe(401);

    const ok = await app.inject({
      method: 'POST',
      url,
      payload: body,
      headers: signInternal(ts, 'POST', url, body, secret),
    });
    expect(ok.statusCode).toBe(200);

    await app.close();
  });

  it('returns 401 when token row has no tokenPhc', async () => {
    const { token, keyId, prefix, ownerId } = await seedKey();
    const row = dbState.rows.find((r) => r.keyId === keyId)!;
    row.tokenPhc = '' as any;

    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/private', headers: bearer(token) });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: { message: 'Invalid API key' } });
    expect(prefix).toBeDefined();
    expect(ownerId).toBeDefined();
    await app.close();
  });

  it('returns 401 when token PHC is valid but does not match presented secret', async () => {
    const seededA = await seedKey();
    const seededB = await seedKey();
    const rowA = dbState.rows.find((r) => r.keyId === seededA.keyId)!;
    const rowB = dbState.rows.find((r) => r.keyId === seededB.keyId)!;
    rowA.tokenPhc = rowB.tokenPhc;

    const app = await makeApp();
    const res = await app.inject({
      method: 'GET',
      url: '/private',
      headers: bearer(seededA.token),
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: { message: 'Invalid API key' } });
    await app.close();
  });

  it('returns 500 when stored PHC string is invalid', async () => {
    const { token, keyId } = await seedKey();
    const row = dbState.rows.find((r) => r.keyId === keyId)!;
    row.tokenPhc = 'invalid-phc';

    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/private', headers: bearer(token) });

    expect(res.statusCode).toBe(500);
    await app.close();
  });

  it('handles rows with undefined scopes/origins by defaulting to empty arrays', async () => {
    const { token, keyId } = await seedKey();
    const row = dbState.rows.find((r) => r.keyId === keyId)!;
    (row as any).scopes = undefined;
    (row as any).allowedOrigins = undefined;

    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/auth-any', headers: bearer(token) });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, authed: true });
    await app.close();
  });
});
