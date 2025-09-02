import type { FastifyInstance, FastifyRequest } from 'fastify';
import { apiUsageTable, billingAccountsTable, db } from '@clearcost/db';
import { and, eq, ilike, sql } from 'drizzle-orm';

/** UTC midnight Date for today (matches pg DATE, mode: 'date') */
function dayStartUTC(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const LIMITS = {
  free: { computePerDay: 10 },
  starter: { computePerDay: 200 },
  growth: { computePerDay: 2000 },
  scale: { computePerDay: 10000 },
} as const;

type PlanKey = keyof typeof LIMITS;

async function getPlan(ownerId: string): Promise<PlanKey> {
  const rows = await db
    .select({ plan: billingAccountsTable.plan })
    .from(billingAccountsTable)
    .where(eq(billingAccountsTable.ownerId, ownerId))
    .limit(1);

  const planStr = (rows[0]?.plan ?? 'free').toLowerCase();
  return planStr in LIMITS ? (planStr as PlanKey) : 'free';
}

async function getTodayComputeUsed(apiKeyId: string): Promise<number> {
  const today = dayStartUTC();

  const rows = await db
    .select({ used: sql<number>`coalesce(sum(${apiUsageTable.count}), 0)` })
    .from(apiUsageTable)
    .where(
      and(
        eq(apiUsageTable.apiKeyId, apiKeyId),
        eq(apiUsageTable.day, today),
        eq(apiUsageTable.method, 'POST'),
        // Use a plain string pattern to satisfy drizzle types
        ilike(apiUsageTable.route, '%/compute')
      )
    )
    .limit(1);

  return rows[0]?.used ?? 0;
}

export default async function planEnforcement(app: FastifyInstance) {
  app.decorate('enforceComputeLimit', async (req: FastifyRequest) => {
    const apiKey = req.apiKey;
    if (!apiKey?.ownerId || !apiKey.id) {
      return { allowed: true, plan: 'unknown', limit: 0, used: 0 };
    }

    const plan = await getPlan(apiKey.ownerId);
    const limit = LIMITS[plan].computePerDay;
    const used = await getTodayComputeUsed(apiKey.id);

    return { allowed: used < limit, plan, limit, used };
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    enforceComputeLimit: (
      req: FastifyRequest
    ) => Promise<{ allowed: boolean; plan: PlanKey | 'unknown'; limit: number; used: number }>;
  }
}
