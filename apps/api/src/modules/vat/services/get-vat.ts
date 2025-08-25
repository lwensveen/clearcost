import { db, vatRulesTable } from '@clearcost/db';
import { and, desc, eq, lte } from 'drizzle-orm';

type VatBase = 'CIF' | 'CIF_PLUS_DUTY';
export type VatRuleRow = {
  ratePct: number;
  base: VatBase;
  effectiveFrom: Date | null;
};

export async function getVat(dest: string, on: Date): Promise<VatRuleRow | null> {
  const [row] = await db
    .select({
      ratePct: vatRulesTable.ratePct,
      base: vatRulesTable.base,
      effectiveFrom: vatRulesTable.effectiveFrom,
    })
    .from(vatRulesTable)
    .where(and(eq(vatRulesTable.dest, dest), lte(vatRulesTable.effectiveFrom, on)))
    .orderBy(desc(vatRulesTable.effectiveFrom))
    .limit(1);

  return row
    ? { ratePct: Number(row.ratePct), base: row.base as VatBase, effectiveFrom: row.effectiveFrom }
    : null;
}
