import { db, fxRatesTable } from '@clearcost/db';
import { and, desc, eq } from 'drizzle-orm';

export async function fetchRate(base: string, quote: string): Promise<number | null> {
  const [row] = await db
    .select({ rate: fxRatesTable.rate })
    .from(fxRatesTable)
    .where(and(eq(fxRatesTable.base, base), eq(fxRatesTable.quote, quote)))
    .orderBy(desc(fxRatesTable.asOf))
    .limit(1);
  return row ? Number(row.rate) : null;
}
