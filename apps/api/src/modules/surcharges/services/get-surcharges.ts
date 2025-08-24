import { db, surchargesTable } from '@clearcost/db';
import { and, eq, gt, isNull, lte, or } from 'drizzle-orm';

export async function getSurcharges(dest: string, on: Date) {
  const rows = await db
    .select({
      fixedAmt: surchargesTable.fixedAmt,
      pctAmt: surchargesTable.pctAmt,
    })
    .from(surchargesTable)
    .where(
      and(
        eq(surchargesTable.dest, dest),
        lte(surchargesTable.effectiveFrom, on),
        or(isNull(surchargesTable.effectiveTo), gt(surchargesTable.effectiveTo, on))
      )
    );
  return rows.map((r) => ({
    fixedAmt: r.fixedAmt ? Number(r.fixedAmt) : 0,
    pctAmt: r.pctAmt ? Number(r.pctAmt) : 0,
  }));
}
