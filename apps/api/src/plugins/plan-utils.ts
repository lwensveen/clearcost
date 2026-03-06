import { billingAccountsTable, db } from '@clearcost/db';
import { eq } from 'drizzle-orm';

export type PlanKey = 'free' | 'starter' | 'growth' | 'scale';

const VALID_PLANS = new Set<string>(['free', 'starter', 'growth', 'scale']);

export async function getPlan(ownerId: string): Promise<PlanKey> {
  const [row] = await db
    .select({ plan: billingAccountsTable.plan })
    .from(billingAccountsTable)
    .where(eq(billingAccountsTable.ownerId, ownerId))
    .limit(1);

  const planStr = (row?.plan ?? 'free').toLowerCase();
  return VALID_PLANS.has(planStr) ? (planStr as PlanKey) : 'free';
}
