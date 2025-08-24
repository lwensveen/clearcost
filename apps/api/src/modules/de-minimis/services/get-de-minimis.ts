import { db, deMinimisTable } from '@clearcost/db';
import { eq } from 'drizzle-orm';

export async function getDeMinimis(dest: string) {
  const rows = await db
    .select({
      currency: deMinimisTable.currency,
      value: deMinimisTable.value,
      appliesTo: deMinimisTable.appliesTo,
    })
    .from(deMinimisTable)
    .where(eq(deMinimisTable.dest, dest))
    .limit(1);
  return rows[0] ?? null;
}
