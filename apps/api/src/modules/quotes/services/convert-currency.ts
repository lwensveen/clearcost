import { db, fxRatesTable } from '@clearcost/db';
import { and, desc, eq } from 'drizzle-orm';

export async function convertCurrency(amount: number, from: string, to: string) {
  if (from === to) return amount;

  const [direct] = await db
    .select({ rate: fxRatesTable.rate })
    .from(fxRatesTable)
    .where(and(eq(fxRatesTable.base, from), eq(fxRatesTable.quote, to)))
    .orderBy(desc(fxRatesTable.asOf))
    .limit(1);

  if (direct) return amount * Number(direct.rate);

  const [rev] = await db
    .select({ rate: fxRatesTable.rate })
    .from(fxRatesTable)
    .where(and(eq(fxRatesTable.base, to), eq(fxRatesTable.quote, from)))
    .orderBy(desc(fxRatesTable.asOf))
    .limit(1);

  if (rev) return amount / Number(rev.rate);

  return amount;
}
