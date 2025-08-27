import { db, fxRatesTable } from '@clearcost/db';
import { desc, eq } from 'drizzle-orm';

/**
 * Returns the latest FX day we consider canonical (ECB-anchored).
 * Falls back to the latest in the table if no ECB rows exist yet.
 */
export async function getCanonicalFxAsOf(): Promise<Date> {
  // Prefer ECB (canonical)
  const [ecb] = await db
    .select({ fxAsOf: fxRatesTable.fxAsOf })
    .from(fxRatesTable)
    .where(eq(fxRatesTable.provider, 'ecb'))
    .orderBy(desc(fxRatesTable.fxAsOf))
    .limit(1);

  if (ecb?.fxAsOf) return ecb.fxAsOf;

  // Fallback: latest of any provider
  const [any] = await db
    .select({ fxAsOf: fxRatesTable.fxAsOf })
    .from(fxRatesTable)
    .orderBy(desc(fxRatesTable.fxAsOf))
    .limit(1);

  if (any?.fxAsOf) return any.fxAsOf;

  // If table is empty, default to today's UTC midnight (won't matter until rates exist)
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
