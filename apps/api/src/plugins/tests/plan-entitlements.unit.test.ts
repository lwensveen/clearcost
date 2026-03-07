import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

// ─── Mock plan-utils: control getPlan return value ─────────────────────
const { planState } = vi.hoisted(() => ({
  planState: { plan: 'free' as string },
}));

vi.mock('../plan-utils.js', () => ({
  getPlan: async (_ownerId: string) => planState.plan,
}));

// ─── Mock @clearcost/db: control manifest/item counts ──────────────────
const { dbState } = vi.hoisted(() => ({
  dbState: { manifestCount: 0, itemCount: 0 },
}));

vi.mock('drizzle-orm', () => ({
  eq: (_left: any, _right: any) => ({ type: 'eq' }),
  sql: (lits: TemplateStringsArray, ..._vals: any[]) => lits.join(''),
}));

vi.mock('@clearcost/db', () => {
  const manifestsTable = { ownerId: 'ownerId' } as const;
  const manifestItemsTable = { manifestId: 'manifestId' } as const;

  const db = {
    select: () => ({
      from: (tbl: any) => ({
        where: async (_pred: any) => {
          // Distinguish between manifest count and item count queries
          // by checking which table was passed
          if (tbl === manifestsTable) {
            return [{ n: dbState.manifestCount }];
          }
          return [{ n: dbState.itemCount }];
        },
      }),
    }),
  };

  return { db, manifestsTable, manifestItemsTable };
});

import planEntitlements from '../plan-entitlements.js';

async function makeApp() {
  const app = Fastify();
  // Call directly (not via register) because planEntitlements is not wrapped
  // with fastify-plugin, so decorators would be scoped/invisible otherwise.
  await planEntitlements(app);
  return app;
}

function fakeReq(ownerId?: string) {
  return {
    apiKey: ownerId ? { ownerId } : undefined,
  } as any;
}

/** Type-narrowing helper: asserts the guard returned a blocked result. */
function assertBlocked(result: {
  allowed: boolean;
}): asserts result is { allowed: false; code: number; reason: string } {
  expect(result.allowed).toBe(false);
}

describe('planEntitlements plugin (unit)', () => {
  beforeEach(() => {
    planState.plan = 'free';
    dbState.manifestCount = 0;
    dbState.itemCount = 0;
  });

  // ─── getLimitsForOwner ─────────────────────────────────────────────

  describe('getLimitsForOwner', () => {
    it('returns free plan limits by default', async () => {
      planState.plan = 'free';
      const app = await makeApp();
      const result = await app.entitlements.getLimitsForOwner('owner-1');

      expect(result.plan).toBe('free');
      expect(result.maxManifests).toBe(1);
      expect(result.maxItemsPerManifest).toBe(100);
      await app.close();
    });

    it('returns starter plan limits', async () => {
      planState.plan = 'starter';
      const app = await makeApp();
      const result = await app.entitlements.getLimitsForOwner('owner-1');

      expect(result.plan).toBe('starter');
      expect(result.maxManifests).toBe(10);
      expect(result.maxItemsPerManifest).toBe(5_000);
      await app.close();
    });

    it('returns growth plan limits', async () => {
      planState.plan = 'growth';
      const app = await makeApp();
      const result = await app.entitlements.getLimitsForOwner('owner-1');

      expect(result.plan).toBe('growth');
      expect(result.maxManifests).toBe(50);
      expect(result.maxItemsPerManifest).toBe(25_000);
      await app.close();
    });

    it('returns scale plan limits (full entitlements)', async () => {
      planState.plan = 'scale';
      const app = await makeApp();
      const result = await app.entitlements.getLimitsForOwner('owner-1');

      expect(result.plan).toBe('scale');
      expect(result.maxManifests).toBe(500);
      expect(result.maxItemsPerManifest).toBe(100_000);
      await app.close();
    });
  });

  // ─── guardCreateManifest ──────────────────────────────────────────

  describe('guardCreateManifest', () => {
    it('allows when manifest count is under free limit', async () => {
      planState.plan = 'free';
      dbState.manifestCount = 0;

      const app = await makeApp();
      const result = await app.entitlements.guardCreateManifest(fakeReq('owner-1'));

      expect(result.allowed).toBe(true);
      expect(result.plan).toBe('free');
      expect(result.have).toBe(0);
      expect(result.max).toBe(1);
      await app.close();
    });

    it('blocks when free plan manifest limit is reached', async () => {
      planState.plan = 'free';
      dbState.manifestCount = 1;

      const app = await makeApp();
      const result = await app.entitlements.guardCreateManifest(fakeReq('owner-1'));

      assertBlocked(result);
      expect(result.code).toBe(402);
      expect(result.reason).toContain('max 1 manifests');
      expect(result.reason).toContain('"free"');
      await app.close();
    });

    it('allows when scale plan has many manifests but under limit', async () => {
      planState.plan = 'scale';
      dbState.manifestCount = 499;

      const app = await makeApp();
      const result = await app.entitlements.guardCreateManifest(fakeReq('owner-1'));

      expect(result.allowed).toBe(true);
      expect(result.plan).toBe('scale');
      expect(result.have).toBe(499);
      expect(result.max).toBe(500);
      await app.close();
    });

    it('blocks when scale plan manifest limit is reached', async () => {
      planState.plan = 'scale';
      dbState.manifestCount = 500;

      const app = await makeApp();
      const result = await app.entitlements.guardCreateManifest(fakeReq('owner-1'));

      assertBlocked(result);
      expect(result.code).toBe(402);
      await app.close();
    });

    it('returns 403 when no ownerId on request', async () => {
      const app = await makeApp();
      const result = await app.entitlements.guardCreateManifest(fakeReq());

      assertBlocked(result);
      expect(result.code).toBe(403);
      expect(result.reason).toBe('No owner');
      await app.close();
    });
  });

  // ─── guardReplaceItems ────────────────────────────────────────────

  describe('guardReplaceItems', () => {
    it('allows when incoming count is under free limit', async () => {
      planState.plan = 'free';

      const app = await makeApp();
      const result = await app.entitlements.guardReplaceItems(fakeReq('owner-1'), 'man-1', 50);

      expect(result.allowed).toBe(true);
      expect(result.plan).toBe('free');
      expect(result.incoming).toBe(50);
      expect(result.max).toBe(100);
      await app.close();
    });

    it('allows when incoming count equals free limit', async () => {
      planState.plan = 'free';

      const app = await makeApp();
      const result = await app.entitlements.guardReplaceItems(fakeReq('owner-1'), 'man-1', 100);

      expect(result.allowed).toBe(true);
      await app.close();
    });

    it('blocks when incoming count exceeds free limit', async () => {
      planState.plan = 'free';

      const app = await makeApp();
      const result = await app.entitlements.guardReplaceItems(fakeReq('owner-1'), 'man-1', 101);

      assertBlocked(result);
      expect(result.code).toBe(402);
      expect(result.reason).toContain('max 100 items/manifest');
      expect(result.reason).toContain('"free"');
      await app.close();
    });

    it('allows scale plan with large item count', async () => {
      planState.plan = 'scale';

      const app = await makeApp();
      const result = await app.entitlements.guardReplaceItems(fakeReq('owner-1'), 'man-1', 100_000);

      expect(result.allowed).toBe(true);
      expect(result.max).toBe(100_000);
      await app.close();
    });

    it('blocks scale plan when exceeding 100k items', async () => {
      planState.plan = 'scale';

      const app = await makeApp();
      const result = await app.entitlements.guardReplaceItems(fakeReq('owner-1'), 'man-1', 100_001);

      assertBlocked(result);
      expect(result.code).toBe(402);
      await app.close();
    });

    it('returns 403 when no ownerId on request', async () => {
      const app = await makeApp();
      const result = await app.entitlements.guardReplaceItems(fakeReq(), 'man-1', 10);

      assertBlocked(result);
      expect(result.code).toBe(403);
      expect(result.reason).toBe('No owner');
      await app.close();
    });
  });

  // ─── guardAppendItems ─────────────────────────────────────────────

  describe('guardAppendItems', () => {
    it('allows when existing + delta is under free limit', async () => {
      planState.plan = 'free';
      dbState.itemCount = 50;

      const app = await makeApp();
      const result = await app.entitlements.guardAppendItems(fakeReq('owner-1'), 'man-1', 49);

      expect(result.allowed).toBe(true);
      expect(result.plan).toBe('free');
      expect(result.have).toBe(50);
      expect(result.delta).toBe(49);
      expect(result.max).toBe(100);
      await app.close();
    });

    it('allows when existing + delta equals free limit', async () => {
      planState.plan = 'free';
      dbState.itemCount = 50;

      const app = await makeApp();
      const result = await app.entitlements.guardAppendItems(fakeReq('owner-1'), 'man-1', 50);

      expect(result.allowed).toBe(true);
      await app.close();
    });

    it('blocks when existing + delta exceeds free limit', async () => {
      planState.plan = 'free';
      dbState.itemCount = 50;

      const app = await makeApp();
      const result = await app.entitlements.guardAppendItems(fakeReq('owner-1'), 'man-1', 51);

      assertBlocked(result);
      expect(result.code).toBe(402);
      expect(result.reason).toContain('50 existing + 51 new = 101');
      expect(result.reason).toContain('"free"');
      await app.close();
    });

    it('treats negative delta as zero', async () => {
      planState.plan = 'free';
      dbState.itemCount = 100;

      const app = await makeApp();
      // delta = -10, Math.max(0, -10) = 0, so next = 100 + 0 = 100 <= 100
      const result = await app.entitlements.guardAppendItems(fakeReq('owner-1'), 'man-1', -10);

      expect(result.allowed).toBe(true);
      await app.close();
    });

    it('allows growth plan with large append', async () => {
      planState.plan = 'growth';
      dbState.itemCount = 20_000;

      const app = await makeApp();
      const result = await app.entitlements.guardAppendItems(fakeReq('owner-1'), 'man-1', 5_000);

      expect(result.allowed).toBe(true);
      expect(result.max).toBe(25_000);
      await app.close();
    });

    it('blocks growth plan when append exceeds limit', async () => {
      planState.plan = 'growth';
      dbState.itemCount = 20_000;

      const app = await makeApp();
      const result = await app.entitlements.guardAppendItems(fakeReq('owner-1'), 'man-1', 5_001);

      assertBlocked(result);
      expect(result.code).toBe(402);
      await app.close();
    });

    it('returns 403 when no ownerId on request', async () => {
      const app = await makeApp();
      const result = await app.entitlements.guardAppendItems(fakeReq(), 'man-1', 10);

      assertBlocked(result);
      expect(result.code).toBe(403);
      expect(result.reason).toBe('No owner');
      await app.close();
    });
  });

  // ─── free vs scale entitlement comparison ─────────────────────────

  describe('free vs scale entitlement comparison', () => {
    it('free plan has strictly lower limits than scale plan', async () => {
      const app = await makeApp();

      planState.plan = 'free';
      const free = await app.entitlements.getLimitsForOwner('owner-1');

      planState.plan = 'scale';
      const scale = await app.entitlements.getLimitsForOwner('owner-1');

      expect(free.maxManifests).toBeLessThan(scale.maxManifests);
      expect(free.maxItemsPerManifest).toBeLessThan(scale.maxItemsPerManifest);
      await app.close();
    });
  });
});
