import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { createHash } from 'node:crypto';
import { apiKeyAuthPlugin, generateApiKey } from '../api-key-auth.js';
import sensible from '@fastify/sensible';

type Row = {
  id: string;
  ownerId: string;
  keyId: string;
  tokenHash: string;
  salt: string;
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
    tokenHash: 'tokenHash',
    salt: 'salt',
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

// helpers mirroring plugin hashing
const sha256Hex = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');
const digestHex = (secret: string, salt: string, pepper: string) =>
  createHash('sha256')
    .update(Buffer.from(`${salt}|${secret}|${pepper}`, 'utf8'))
    .digest('hex');

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

  return app;
}

function bearer(token: string) {
  return { authorization: `Bearer ${token}` };
}

function signInternal(ts: number, method: string, url: string, body: unknown, secret: string) {
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body ?? {});
  const payload = `${ts}:${method}:${url}:${sha256Hex(Buffer.from(bodyStr))}`;
  const sig = createHash('sha256')
    .update(payload + '|' + secret)
    .digest('hex');
  return { 'x-cc-ts': String(ts), 'x-cc-sig': sig };
}

// Seed a row that matches the plugin’s verification logic
function seedKey({
  prefix = 'test' as 'test' | 'live',
  scopes = ['read:things'] as string[],
  allowedOrigins = [] as string[],
  isActive = true,
  expiresAt = null as Date | null,
  revokedAt = null as Date | null,
  ownerId = 'owner-1',
  pepper = 'pepper-xyz',
} = {}) {
  const { token, keyId, secret, salt, prefix: px } = generateApiKey(prefix);
  const tokenHash = digestHex(secret, salt, pepper);
  dbState.rows.push({
    id: `id-${keyId}`,
    ownerId,
    keyId,
    tokenHash,
    salt,
    prefix: px,
    isActive,
    scopes,
    allowedOrigins,
    expiresAt: expiresAt ?? undefined,
    revokedAt: revokedAt ?? undefined,
  });
  return { token, keyId, secret, prefix: px, ownerId };
}

describe('apiKeyAuthPlugin (unit, DB mocked)', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    process.env.API_KEY_PEPPER = 'pepper-xyz';
    process.env.INTERNAL_SIGNING_SECRET = 'internal-secret-123';
    dbState.rows.length = 0; // clear
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  it('401 when missing key', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/private' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('200 with valid key and principal attached', async () => {
    const { token } = seedKey();
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

  it('401 for inactive / expired / revoked', async () => {
    const app = await makeApp();

    const { token: t1 } = seedKey({ isActive: false });
    expect(
      (await app.inject({ method: 'GET', url: '/private', headers: bearer(t1) })).statusCode
    ).toBe(401);

    const { token: t2 } = seedKey({ expiresAt: new Date(Date.now() - 60_000) });
    expect(
      (await app.inject({ method: 'GET', url: '/private', headers: bearer(t2) })).statusCode
    ).toBe(401);

    const { token: t3 } = seedKey({ revokedAt: new Date() });
    expect(
      (await app.inject({ method: 'GET', url: '/private', headers: bearer(t3) })).statusCode
    ).toBe(401);

    await app.close();
  });

  it('401 on prefix mismatch', async () => {
    const { token } = seedKey({ prefix: 'test' });
    const liveToken = token.replace(/^ck_test_/, 'ck_live_'); // mismatched
    const app = await makeApp();
    const r = await app.inject({ method: 'GET', url: '/private', headers: bearer(liveToken) });
    expect(r.statusCode).toBe(401);
    await app.close();
  });

  it('403 when missing required scope', async () => {
    const { token } = seedKey({ scopes: ['read:other'] });
    const app = await makeApp();
    const r = await app.inject({ method: 'GET', url: '/private', headers: bearer(token) });
    expect(r.statusCode).toBe(403);
    await app.close();
  });

  it('ABAC owner check: 403 mismatch, 200 match', async () => {
    const { token } = seedKey({ ownerId: 'owner-1' });
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
    const { token } = seedKey({ allowedOrigins: ['https://a.example'] });
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

    const { token: adminToken } = seedKey({ scopes: ['admin:all'] });
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
});
