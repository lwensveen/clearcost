import { db, fxRatesTable } from '@clearcost/db';
import { and, desc, eq, lte } from 'drizzle-orm';

export async function fetchRate(base: string, quote: string, on?: Date): Promise<number | null> {
  const predicate = on
    ? and(eq(fxRatesTable.base, base), eq(fxRatesTable.quote, quote), lte(fxRatesTable.asOf, on))
    : and(eq(fxRatesTable.base, base), eq(fxRatesTable.quote, quote));

  const [row] = await db
    .select({ rate: fxRatesTable.rate })
    .from(fxRatesTable)
    .where(predicate)
    .orderBy(desc(fxRatesTable.asOf))
    .limit(1);

  return row ? Number(row.rate) : null;
}
