import { db, surchargesTable } from '@clearcost/db';
import { and, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { z } from 'zod/v4';
import { SurchargeSelectCoercedSchema } from '@clearcost/types';

export type GetSurchargesScopedInput = {
  dest: string;
  on: Date;
  origin?: string | null;
  hs6?: string | null;
};

const SelectRowSchema = SurchargeSelectCoercedSchema.pick({
  id: true,
  dest: true,
  origin: true,
  hs6: true,
  code: true,
  fixedAmt: true,
  pctAmt: true,
  effectiveFrom: true,
  effectiveTo: true,
  notes: true,
});
type SurchargeRowOut = z.infer<typeof SelectRowSchema>;

/**
 * Return active surcharges for a given destination as of `on`, optionally scoped
 * by `origin` and/or `hs6`. Results are ranked by specificity:
 * - origin+hs6 (3) > origin-only (2) > hs6-only (1) > generic (0)
 */
export async function getSurchargesScoped(
  input: GetSurchargesScopedInput
): Promise<SurchargeRowOut[]> {
  const destUp = input.dest.toUpperCase();
  const originUp = input.origin ? String(input.origin).toUpperCase() : null;
  const hs6Key = input.hs6 ? String(input.hs6).slice(0, 6) : null;

  const rows = await db
    .select({
      id: surchargesTable.id,
      dest: surchargesTable.dest,
      origin: surchargesTable.origin,
      hs6: surchargesTable.hs6,
      code: surchargesTable.code,
      fixedAmt: surchargesTable.fixedAmt,
      pctAmt: surchargesTable.pctAmt,
      effectiveFrom: surchargesTable.effectiveFrom,
      effectiveTo: surchargesTable.effectiveTo,
      notes: surchargesTable.notes,
    })
    .from(surchargesTable)
    .where(
      and(
        eq(surchargesTable.dest, destUp),
        lte(surchargesTable.effectiveFrom, input.on),
        or(isNull(surchargesTable.effectiveTo), gt(surchargesTable.effectiveTo, input.on))
      )
    );

  const coerced = rows.map((r) =>
    SelectRowSchema.parse({
      ...r,
    })
  );

  const scored = coerced
    .map((r) => {
      const matchOrigin =
        !!originUp && typeof r.origin === 'string' && r.origin.toUpperCase() === originUp;
      const matchHs6 = !!hs6Key && r.hs6 === hs6Key;
      const score = (matchOrigin ? 2 : 0) + (matchHs6 ? 1 : 0);
      return { r, score };
    })
    .filter(({ r, score }) => {
      if (!originUp && !hs6Key) return true;
      if (score > 0) return true;
      return !r.origin && !r.hs6;
    })
    .sort((a, b) => b.score - a.score);

  return scored.map(({ r }) => r);
}
