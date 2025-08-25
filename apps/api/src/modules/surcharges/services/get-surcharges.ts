import { db, surchargesTable } from '@clearcost/db';
import { and, eq, gt, isNull, lte, or } from 'drizzle-orm';

export type SurchargeRow = {
  id: string;
  fixedAmt: number;
  pctAmt: number;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
};

export async function getSurcharges(dest: string, on: Date): Promise<SurchargeRow[]> {
  const rows = await db
    .select({
      id: surchargesTable.id,
      fixedAmt: surchargesTable.fixedAmt,
      pctAmt: surchargesTable.pctAmt,
      effectiveFrom: surchargesTable.effectiveFrom,
      effectiveTo: surchargesTable.effectiveTo,
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
    id: r.id as unknown as string,
    fixedAmt: r.fixedAmt != null ? Number(r.fixedAmt) : 0,
    pctAmt: r.pctAmt != null ? Number(r.pctAmt) : 0,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo ?? null,
  }));
}
