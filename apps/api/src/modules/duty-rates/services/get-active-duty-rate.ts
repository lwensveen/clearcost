import { db, dutyRatesTable } from '@clearcost/db';
import { and, desc, eq, gt, isNull, lte, or } from 'drizzle-orm';

export async function getActiveDutyRate(dest: string, hs6: string, on: Date) {
  const rows = await db
    .select({
      ratePct: dutyRatesTable.ratePct,
      rule: dutyRatesTable.rule,
      from: dutyRatesTable.effectiveFrom,
    })
    .from(dutyRatesTable)
    .where(
      and(
        eq(dutyRatesTable.dest, dest),
        eq(dutyRatesTable.hs6, hs6),
        lte(dutyRatesTable.effectiveFrom, on),
        or(isNull(dutyRatesTable.effectiveTo), gt(dutyRatesTable.effectiveTo, on))
      )
    )
    .orderBy(desc(dutyRatesTable.effectiveFrom))
    .limit(1);
  return rows[0] ?? null;
}
