import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

// ─── Mock plan-utils: control getPlan return value ─────────────────────
const { planState } = vi.hoisted(() => ({
  planState: { plan: 'free' as string },
}));

vi.mock('../plan-utils.js', () => ({
  getPlan: async (_ownerId: string) => planState.plan,
}));

// ─── Mock @clearcost/db: capture query results for getTodayComputeUsed ─
const { usageState } = vi.hoisted(() => ({
  usageState: { used: 0 },
}));

vi.mock('drizzle-orm', () => ({
  eq: (_left: any, _right: any) => ({ type: 'eq' }),
  and: (..._conds: any[]) => ({ type: 'and' }),
  ilike: (_col: any, _pattern: string) => ({ type: 'ilike' }),
  sql: (lits: TemplateStringsArray, ..._vals: any[]) => lits.join(''),
}));

vi.mock('@clearcost/db', () => {
  const apiUsageTable = {
    apiKeyId: 'apiKeyId',
    day: 'day',
    method: 'method',
    route: 'route',
    count: 'count',
  } as const;

  const db = {
    select: () => ({
      from: (_tbl: any) => ({
        where: (_pred: any) => ({
          limit: async (_n: number) => [{ used: usageState.used }],
        }),
      }),
    }),
  };

  return { db, apiUsageTable };
});

import planEnforcement from '../plan-enforcement.js';

async function makeApp() {
  const app = Fastify();
  // Call directly (not via register) because planEnforcement is not wrapped
  // with fastify-plugin, so decorators would be scoped/invisible otherwise.
  await planEnforcement(app);
  return app;
}

function fakeReq(opts: { apiKeyId?: string; ownerId?: string } = {}) {
  return {
    apiKey: opts.apiKeyId ? { id: opts.apiKeyId, ownerId: opts.ownerId ?? 'owner-1' } : undefined,
  } as any;
}

describe('planEnforcement plugin (unit)', () => {
  beforeEach(() => {
    planState.plan = 'free';
    usageState.used = 0;
  });

  // ─── decorator registration ───────────────────────────────────────

  it('decorates the Fastify instance with enforceComputeLimit', async () => {
    const app = await makeApp();
    expect(typeof app.enforceComputeLimit).toBe('function');
    await app.close();
  });

  // ─── free plan limits ─────────────────────────────────────────────

  it('allows requests when free plan usage is under limit (10/day)', async () => {
    planState.plan = 'free';
    usageState.used = 5;

    const app = await makeApp();
    const result = await app.enforceComputeLimit(fakeReq({ apiKeyId: 'key-1' }));

    expect(result.allowed).toBe(true);
    expect(result.plan).toBe('free');
    expect(result.limit).toBe(10);
    expect(result.used).toBe(5);
    await app.close();
  });

  it('blocks requests when free plan usage meets limit', async () => {
    planState.plan = 'free';
    usageState.used = 10;

    const app = await makeApp();
    const result = await app.enforceComputeLimit(fakeReq({ apiKeyId: 'key-1' }));

    expect(result.allowed).toBe(false);
    expect(result.plan).toBe('free');
    expect(result.limit).toBe(10);
    expect(result.used).toBe(10);
    await app.close();
  });

  it('blocks requests when free plan usage exceeds limit', async () => {
    planState.plan = 'free';
    usageState.used = 15;

    const app = await makeApp();
    const result = await app.enforceComputeLimit(fakeReq({ apiKeyId: 'key-1' }));

    expect(result.allowed).toBe(false);
    expect(result.used).toBe(15);
    await app.close();
  });

  // ─── starter plan limits ──────────────────────────────────────────

  it('allows requests when starter plan usage is under limit (200/day)', async () => {
    planState.plan = 'starter';
    usageState.used = 100;

    const app = await makeApp();
    const result = await app.enforceComputeLimit(fakeReq({ apiKeyId: 'key-1' }));

    expect(result.allowed).toBe(true);
    expect(result.plan).toBe('starter');
    expect(result.limit).toBe(200);
    await app.close();
  });

  it('blocks requests when starter plan usage meets limit', async () => {
    planState.plan = 'starter';
    usageState.used = 200;

    const app = await makeApp();
    const result = await app.enforceComputeLimit(fakeReq({ apiKeyId: 'key-1' }));

    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(200);
    await app.close();
  });

  // ─── growth plan limits ───────────────────────────────────────────

  it('allows requests when growth plan usage is under limit (2000/day)', async () => {
    planState.plan = 'growth';
    usageState.used = 1999;

    const app = await makeApp();
    const result = await app.enforceComputeLimit(fakeReq({ apiKeyId: 'key-1' }));

    expect(result.allowed).toBe(true);
    expect(result.plan).toBe('growth');
    expect(result.limit).toBe(2000);
    await app.close();
  });

  it('blocks requests when growth plan usage meets limit', async () => {
    planState.plan = 'growth';
    usageState.used = 2000;

    const app = await makeApp();
    const result = await app.enforceComputeLimit(fakeReq({ apiKeyId: 'key-1' }));

    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(2000);
    await app.close();
  });

  // ─── scale plan limits ────────────────────────────────────────────

  it('allows requests when scale plan usage is under limit (10000/day)', async () => {
    planState.plan = 'scale';
    usageState.used = 9999;

    const app = await makeApp();
    const result = await app.enforceComputeLimit(fakeReq({ apiKeyId: 'key-1' }));

    expect(result.allowed).toBe(true);
    expect(result.plan).toBe('scale');
    expect(result.limit).toBe(10000);
    await app.close();
  });

  it('blocks requests when scale plan usage meets limit', async () => {
    planState.plan = 'scale';
    usageState.used = 10000;

    const app = await makeApp();
    const result = await app.enforceComputeLimit(fakeReq({ apiKeyId: 'key-1' }));

    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(10000);
    await app.close();
  });

  // ─── missing apiKey ───────────────────────────────────────────────

  it('returns allowed=true with unknown plan when apiKey is missing', async () => {
    const app = await makeApp();
    const result = await app.enforceComputeLimit({ apiKey: undefined } as any);

    expect(result.allowed).toBe(true);
    expect(result.plan).toBe('unknown');
    expect(result.limit).toBe(0);
    expect(result.used).toBe(0);
    await app.close();
  });

  it('returns allowed=true with unknown plan when apiKey has no ownerId', async () => {
    const app = await makeApp();
    const result = await app.enforceComputeLimit({
      apiKey: { id: 'key-1', ownerId: undefined },
    } as any);

    expect(result.allowed).toBe(true);
    expect(result.plan).toBe('unknown');
    await app.close();
  });

  it('returns allowed=true with unknown plan when apiKey has no id', async () => {
    const app = await makeApp();
    const result = await app.enforceComputeLimit({
      apiKey: { id: undefined, ownerId: 'owner-1' },
    } as any);

    expect(result.allowed).toBe(true);
    expect(result.plan).toBe('unknown');
    await app.close();
  });

  // ─── boundary: used=0 always allowed ──────────────────────────────

  it('allows requests at zero usage for any plan', async () => {
    for (const plan of ['free', 'starter', 'growth', 'scale'] as const) {
      planState.plan = plan;
      usageState.used = 0;

      const app = await makeApp();
      const result = await app.enforceComputeLimit(fakeReq({ apiKeyId: 'key-1' }));

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(0);
      await app.close();
    }
  });
});
