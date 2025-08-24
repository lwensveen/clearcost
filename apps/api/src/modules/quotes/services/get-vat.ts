import { db, vatRulesTable } from '@clearcost/db';
import { eq } from 'drizzle-orm';

export async function getVat(dest: string) {
  const rows = await db
    .select({ ratePct: vatRulesTable.ratePct, base: vatRulesTable.base })
    .from(vatRulesTable)
    .where(eq(vatRulesTable.dest, dest))
    .limit(1);
  return rows[0] ?? null;
}
