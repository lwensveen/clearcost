import { db, surchargesTable } from '@clearcost/db';
import { and, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { z } from 'zod/v4';
import { SurchargeSelectCoercedSchema } from '@clearcost/types';

const SelectRowSchema = SurchargeSelectCoercedSchema.pick({
  id: true,
  dest: true,
  origin: true,
  hs6: true,
  surchargeCode: true,
  rateType: true,
  applyLevel: true,
  valueBasis: true,
  transportMode: true,
  currency: true,
  fixedAmt: true,
  pctAmt: true,
  minAmt: true,
  maxAmt: true,
  unitAmt: true,
  unitCode: true,
  sourceUrl: true,
  sourceRef: true,
  effectiveFrom: true,
  effectiveTo: true,
  notes: true,
});
type SurchargeRowOut = z.infer<typeof SelectRowSchema>;
type TransportMode = SurchargeRowOut['transportMode']; // 'ALL' | 'OCEAN' | 'AIR' | 'TRUCK' | 'RAIL'
type ApplyLevel = SurchargeRowOut['applyLevel']; // 'entry' | 'line' | 'shipment' | 'program'

export type GetSurchargesScopedInput = {
  dest: string;
  on: Date;
  origin?: string | null;
  hs6?: string | null;
  transportMode?: TransportMode | string | null; // allow string; normalize
  applyLevel?: ApplyLevel | string | null; // allow string; normalize
};

// ---- helpers ---------------------------------------------------------------
const MODES = ['ALL', 'OCEAN', 'AIR', 'TRUCK', 'RAIL'] as const;
const LEVELS = ['entry', 'line', 'shipment', 'program'] as const;

function normMode(v?: string | null): TransportMode | null {
  if (!v) return null;
  const u = v.toUpperCase();
  return (MODES as readonly string[]).includes(u) ? (u as TransportMode) : null;
}
function normLevel(v?: string | null): ApplyLevel | null {
  if (!v) return null;
  const u = v.toLowerCase();
  return (LEVELS as readonly string[]).includes(u) ? (u as ApplyLevel) : null;
}
function normHs6(v?: string | null): string | null {
  if (!v) return null;
  const s = String(v).replace(/\D+/g, '').slice(0, 6);
  return s.length === 6 ? s : null;
}

// ---- main ------------------------------------------------------------------
/**
 * Return active surcharges for a given destination as of `on`, optionally scoped
 * by transport mode, apply level, origin and/or hs6.
 *
 * Ranking (desc):
 *  - transportMode exact (row=ALL gets smaller credit if no exact)
 *  - applyLevel exact
 *  - origin exact
 *  - hs6 exact
 */
export async function getSurchargesScoped(
  input: GetSurchargesScopedInput
): Promise<SurchargeRowOut[]> {
  const destUp = input.dest.toUpperCase();
  const originUp = input.origin ? String(input.origin).toUpperCase() : null;
  const hs6Key = normHs6(input.hs6);
  const mode = normMode(input.transportMode ?? null);
  const level = normLevel(input.applyLevel ?? null);

  // Base active-window filter
  const baseWhere = and(
    eq(surchargesTable.dest, destUp),
    lte(surchargesTable.effectiveFrom, input.on),
    or(isNull(surchargesTable.effectiveTo), gt(surchargesTable.effectiveTo, input.on))
  );

  // If mode supplied, include rows where mode=ALL OR mode=exact
  const withMode = mode
    ? and(
        baseWhere,
        or(
          eq(surchargesTable.transportMode, 'ALL' as any),
          eq(surchargesTable.transportMode, mode as any)
        )
      )
    : baseWhere;

  // If level supplied, require exact level match
  const where = level ? and(withMode, eq(surchargesTable.applyLevel, level as any)) : withMode;

  const rows = await db
    .select({
      id: surchargesTable.id,
      dest: surchargesTable.dest,
      origin: surchargesTable.origin,
      hs6: surchargesTable.hs6,
      surchargeCode: surchargesTable.surchargeCode,
      rateType: surchargesTable.rateType,
      applyLevel: surchargesTable.applyLevel,
      valueBasis: surchargesTable.valueBasis,
      transportMode: surchargesTable.transportMode,
      currency: surchargesTable.currency,
      fixedAmt: surchargesTable.fixedAmt,
      pctAmt: surchargesTable.pctAmt,
      minAmt: surchargesTable.minAmt,
      maxAmt: surchargesTable.maxAmt,
      unitAmt: surchargesTable.unitAmt,
      unitCode: surchargesTable.unitCode,
      sourceUrl: surchargesTable.sourceUrl,
      sourceRef: surchargesTable.sourceRef,
      effectiveFrom: surchargesTable.effectiveFrom,
      effectiveTo: surchargesTable.effectiveTo,
      notes: surchargesTable.notes,
    })
    .from(surchargesTable)
    .where(where);

  const coerced = rows.map((r) => SelectRowSchema.parse(r));

  const ranked = coerced
    .map((r) => {
      let score = 0;

      // transportMode specificity
      if (mode) {
        if (r.transportMode === mode)
          score += 8; // exact mode
        else if (r.transportMode === 'ALL') score += 2; // generic ok
      } else {
        // no mode requested: slight preference to non-ALL (more specific)
        score += r.transportMode === 'ALL' ? 0 : 1;
      }

      // applyLevel specificity (only matters if requested)
      if (level && r.applyLevel === level) score += 4;

      // origin & hs6 specificity
      const matchOrigin =
        !!originUp && typeof r.origin === 'string' && r.origin.toUpperCase() === originUp;
      const matchHs6 = !!hs6Key && r.hs6 === hs6Key;
      if (matchOrigin) score += 2;
      if (matchHs6) score += 1;

      // Tie-breaker: more constrained rows win
      const tiebreak = (r.transportMode === 'ALL' ? 0 : 1) + (r.origin ? 1 : 0) + (r.hs6 ? 1 : 0);

      return { r, score, tiebreak };
    })
    .filter(({ r }) => {
      // If origin/hs6 requested, allow exact matches or fall back to generic rows.
      if (!originUp && !hs6Key) return true;
      if (originUp && r.origin && r.origin.toUpperCase() === originUp) return true;
      if (hs6Key && r.hs6 === hs6Key) return true;
      // generic fallback (no origin & no hs6)
      return !r.origin && !r.hs6;
    })
    .sort((a, b) => b.score - a.score || b.tiebreak - a.tiebreak);

  return ranked.map(({ r }) => r);
}
