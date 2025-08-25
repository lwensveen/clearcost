import { db, dutyRatesTable } from '@clearcost/db';
import { and, desc, eq, gt, isNull, lte, or } from 'drizzle-orm';

export type DutyRateRow = {
  ratePct: number;
  rule: string | null;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
};

export async function getActiveDutyRate(
  dest: string,
  hs6: string,
  on: Date
): Promise<DutyRateRow | null> {
  const [row] = await db
    .select({
      ratePct: dutyRatesTable.ratePct,
      rule: dutyRatesTable.rule,
      effectiveFrom: dutyRatesTable.effectiveFrom,
      effectiveTo: dutyRatesTable.effectiveTo,
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

  return row
    ? {
        ratePct: row.ratePct != null ? Number(row.ratePct) : 0,
        rule: row.rule ?? null,
        effectiveFrom: row.effectiveFrom,
        effectiveTo: row.effectiveTo ?? null,
      }
    : null;
}
