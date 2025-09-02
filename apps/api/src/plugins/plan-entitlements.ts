import type { FastifyInstance, FastifyRequest } from 'fastify';
import { billingAccountsTable, db, manifestItemsTable, manifestsTable } from '@clearcost/db';
import { eq, sql } from 'drizzle-orm';

/** Per-plan limits, overrideable via env */
function int(env: string | undefined, def: number) {
  const n = Number(env);
  return Number.isFinite(n) && n >= 0 ? n : def;
}

const LIMITS = {
  free: {
    maxManifests: int(process.env.CC_LIMIT_FREE_MAX_MANIFESTS, 1),
    maxItemsPerManifest: int(process.env.CC_LIMIT_FREE_MAX_ITEMS_PER_MANIFEST, 100),
  },
  starter: {
    maxManifests: int(process.env.CC_LIMIT_STARTER_MAX_MANIFESTS, 10),
    maxItemsPerManifest: int(process.env.CC_LIMIT_STARTER_MAX_ITEMS_PER_MANIFEST, 5_000),
  },
  growth: {
    maxManifests: int(process.env.CC_LIMIT_GROWTH_MAX_MANIFESTS, 50),
    maxItemsPerManifest: int(process.env.CC_LIMIT_GROWTH_MAX_ITEMS_PER_MANIFEST, 25_000),
  },
  scale: {
    maxManifests: int(process.env.CC_LIMIT_SCALE_MAX_MANIFESTS, 500),
    maxItemsPerManifest: int(process.env.CC_LIMIT_SCALE_MAX_ITEMS_PER_MANIFEST, 100_000),
  },
} as const;

type PlanKey = keyof typeof LIMITS;

async function getPlan(ownerId: string): Promise<PlanKey> {
  const [row] = await db
    .select({ plan: billingAccountsTable.plan })
    .from(billingAccountsTable)
    .where(eq(billingAccountsTable.ownerId, ownerId))
    .limit(1);
  const p = (row?.plan ?? 'free').toLowerCase();
  return (p in LIMITS ? p : 'free') as PlanKey;
}

async function countManifests(ownerId: string): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`coalesce(count(*),0)` })
    .from(manifestsTable)
    .where(eq(manifestsTable.ownerId, ownerId));
  return r?.n ?? 0;
}

async function countItems(manifestId: string): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`coalesce(count(*),0)` })
    .from(manifestItemsTable)
    .where(eq(manifestItemsTable.manifestId, manifestId));
  return r?.n ?? 0;
}

export default async function planEntitlements(app: FastifyInstance) {
  app.decorate('entitlements', {
    async getLimitsForOwner(ownerId: string) {
      const plan = await getPlan(ownerId);
      return { plan, ...LIMITS[plan] };
    },

    /**
     * Guard: creating a new manifest for owner.
     */
    async guardCreateManifest(req: FastifyRequest) {
      const ownerId = req.apiKey?.ownerId;
      if (!ownerId) return { allowed: false, reason: 'No owner', code: 403 };

      const plan = await getPlan(ownerId);
      const limits = LIMITS[plan];
      const have = await countManifests(ownerId);

      if (have >= limits.maxManifests) {
        return {
          allowed: false,
          reason: `Plan limit exceeded: max ${limits.maxManifests} manifests on "${plan}"`,
          code: 402 as const,
          plan,
          have,
          max: limits.maxManifests,
        };
      }
      return { allowed: true as const, plan, have, max: limits.maxManifests };
    },

    /**
     * Guard: replacing all items in a manifest with `incomingCount`.
     * Use for "replace items" or bulk import endpoints.
     */
    async guardReplaceItems(req: FastifyRequest, manifestId: string, incomingCount: number) {
      const ownerId = req.apiKey?.ownerId;
      if (!ownerId) return { allowed: false, reason: 'No owner', code: 403 };

      const plan = await getPlan(ownerId);
      const limits = LIMITS[plan];

      if (incomingCount > limits.maxItemsPerManifest) {
        return {
          allowed: false,
          reason: `Plan limit exceeded: max ${limits.maxItemsPerManifest} items/manifest on "${plan}"`,
          code: 402 as const,
          plan,
          incoming: incomingCount,
          max: limits.maxItemsPerManifest,
        };
      }
      return {
        allowed: true as const,
        plan,
        incoming: incomingCount,
        max: limits.maxItemsPerManifest,
      };
    },

    /**
     * Guard: adding N more items to an existing manifest (append).
     * Validates (current + delta) <= limit.
     */
    async guardAppendItems(req: FastifyRequest, manifestId: string, delta: number) {
      const ownerId = req.apiKey?.ownerId;
      if (!ownerId) return { allowed: false, reason: 'No owner', code: 403 };

      const plan = await getPlan(ownerId);
      const limits = LIMITS[plan];
      const have = await countItems(manifestId);
      const next = have + Math.max(0, delta);

      if (next > limits.maxItemsPerManifest) {
        return {
          allowed: false,
          reason: `Plan limit exceeded: ${have} existing + ${delta} new = ${next} > ${limits.maxItemsPerManifest} on "${plan}"`,
          code: 402 as const,
          plan,
          have,
          delta,
          max: limits.maxItemsPerManifest,
        };
      }
      return { allowed: true as const, plan, have, delta, max: limits.maxItemsPerManifest };
    },
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    entitlements: {
      getLimitsForOwner(
        ownerId: string
      ): Promise<{ plan: PlanKey; maxManifests: number; maxItemsPerManifest: number }>;
      guardCreateManifest(req: FastifyRequest): Promise<
        | { allowed: true; plan: PlanKey; have: number; max: number }
        | {
            allowed: false;
            reason: string;
            code: 402 | 403;
            plan?: PlanKey;
            have?: number;
            max?: number;
          }
      >;
      guardReplaceItems(
        req: FastifyRequest,
        manifestId: string,
        incomingCount: number
      ): Promise<
        | { allowed: true; plan: PlanKey; incoming: number; max: number }
        | {
            allowed: false;
            reason: string;
            code: 402 | 403;
            plan?: PlanKey;
            incoming?: number;
            max?: number;
          }
      >;
      guardAppendItems(
        req: FastifyRequest,
        manifestId: string,
        delta: number
      ): Promise<
        | { allowed: true; plan: PlanKey; have: number; delta: number; max: number }
        | {
            allowed: false;
            reason: string;
            code: 402 | 403;
            plan?: PlanKey;
            have?: number;
            delta?: number;
            max?: number;
          }
      >;
    };
  }
}
