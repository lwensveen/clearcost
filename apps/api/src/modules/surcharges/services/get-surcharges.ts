import { db, surchargesTable } from '@clearcost/db';
import { and, desc, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { z } from 'zod/v4';
import { SurchargeSelectCoercedSchema } from '@clearcost/types';
import type { LookupResult } from '../../../lib/lookup-meta.js';

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
type TransportMode = SurchargeRowOut['transportMode']; // e.g. 'ALL' | 'OCEAN' | 'AIR' | 'TRUCK' | 'RAIL' | 'BARGE'
type ApplyLevel = SurchargeRowOut['applyLevel']; // 'entry' | 'line' | 'shipment' | 'program'
type RankedSurchargeRow = { row: SurchargeRowOut; score: number; tiebreak: number };

export type GetSurchargesScopedInput = {
  dest: string;
  on: Date;
  origin?: string | null;
  hs6?: string | null;
  transportMode?: TransportMode | string | null; // allow string; normalize
  applyLevel?: ApplyLevel | string | null; // allow string; normalize
};

export type SurchargesLookupResult = LookupResult<SurchargeRowOut[]>;

export function latestSurchargeEffectiveFrom(
  rows: Array<{ effectiveFrom: Date | null }>
): Date | null {
  let latest: Date | null = null;
  for (const row of rows) {
    if (!row.effectiveFrom) continue;
    if (!latest || row.effectiveFrom.getTime() > latest.getTime()) {
      latest = row.effectiveFrom;
    }
  }
  return latest;
}

// ---- helpers ---------------------------------------------------------------
const MODES = ['ALL', 'OCEAN', 'AIR', 'TRUCK', 'RAIL', 'BARGE'] as const;
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

function scoreSurchargeRow(
  row: SurchargeRowOut,
  input: {
    originUp: string | null;
    hs6Key: string | null;
    mode: TransportMode | null;
    level: ApplyLevel | null;
  }
): RankedSurchargeRow {
  const { originUp, hs6Key, mode, level } = input;
  let score = 0;

  if (mode) {
    if (row.transportMode === mode)
      score += 8; // exact mode
    else if (row.transportMode === 'ALL') score += 2; // generic fallback
  } else {
    score += row.transportMode === 'ALL' ? 0 : 1;
  }

  if (level && row.applyLevel === level) score += 4;

  const matchOrigin =
    !!originUp && typeof row.origin === 'string' && row.origin.toUpperCase() === originUp;
  const matchHs6 = !!hs6Key && row.hs6 === hs6Key;
  if (matchOrigin) score += 2;
  if (matchHs6) score += 1;

  const tiebreak =
    (row.transportMode === 'ALL' ? 0 : 1) +
    (row.origin ? 1 : 0) +
    (row.hs6 ? 1 : 0) +
    (row.effectiveFrom?.getTime() ?? 0) / 1_000_000_000_000;

  return { row, score, tiebreak };
}

function rowMatchesFallbackScope(
  row: SurchargeRowOut,
  input: { originUp: string | null; hs6Key: string | null }
) {
  const { originUp, hs6Key } = input;
  if (!originUp && !hs6Key) return true;
  if (originUp && row.origin && row.origin.toUpperCase() === originUp) return true;
  if (hs6Key && row.hs6 === hs6Key) return true;
  return !row.origin && !row.hs6;
}

function scopedSurchargeKey(
  row: SurchargeRowOut,
  input: { mode: TransportMode | null; originUp: string | null; hs6Key: string | null }
) {
  const parts: string[] = [row.surchargeCode, row.applyLevel];
  // For scoped quote lookups, treat ALL + exact mode as a single fallback set.
  if (!input.mode) parts.push(row.transportMode);
  // For origin/HS-scoped lookups, treat specific + generic rows as one fallback set.
  if (!input.originUp) parts.push(row.origin ?? '');
  if (!input.hs6Key) parts.push(row.hs6 ?? '');
  return parts.join('::');
}

export function selectScopedSurchargeRows(
  rows: SurchargeRowOut[],
  input: {
    originUp: string | null;
    hs6Key: string | null;
    mode: TransportMode | null;
    level: ApplyLevel | null;
  }
): SurchargeRowOut[] {
  const ranked = rows
    .map((row) => scoreSurchargeRow(row, input))
    .filter(({ row }) => rowMatchesFallbackScope(row, input))
    .sort((a, b) => b.score - a.score || b.tiebreak - a.tiebreak);

  // Prevent double-charging when both specific and generic fallback rows match.
  const byScopeKey = new Map<string, SurchargeRowOut>();
  for (const rankedRow of ranked) {
    const key = scopedSurchargeKey(rankedRow.row, input);
    if (!byScopeKey.has(key)) byScopeKey.set(key, rankedRow.row);
  }

  return [...byScopeKey.values()];
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
export async function getSurchargesScopedWithMeta(
  input: GetSurchargesScopedInput
): Promise<SurchargesLookupResult> {
  try {
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
          or(eq(surchargesTable.transportMode, 'ALL'), eq(surchargesTable.transportMode, mode))
        )
      : baseWhere;

    // If level supplied, require exact level match
    const where = level ? and(withMode, eq(surchargesTable.applyLevel, level)) : withMode;

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

    const value = selectScopedSurchargeRows(coerced, {
      originUp,
      hs6Key,
      mode,
      level,
    });
    if (value.length > 0) {
      return {
        value,
        meta: {
          status: 'ok',
          dataset: value.find((row) => row.sourceRef)?.sourceRef ?? null,
          effectiveFrom: latestSurchargeEffectiveFrom(value),
        },
      };
    }

    const [coverage] = await db
      .select({
        sourceRef: surchargesTable.sourceRef,
        effectiveFrom: surchargesTable.effectiveFrom,
      })
      .from(surchargesTable)
      .where(eq(surchargesTable.dest, destUp))
      .orderBy(desc(surchargesTable.effectiveFrom))
      .limit(1);

    if (!coverage) {
      return { value: [], meta: { status: 'no_dataset' } };
    }

    return {
      value: [],
      meta: {
        status: 'no_match',
        dataset: coverage.sourceRef ?? null,
        effectiveFrom: coverage.effectiveFrom ?? null,
      },
    };
  } catch (error: unknown) {
    return {
      value: [],
      meta: {
        status: 'error',
        note: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function getSurchargesScoped(
  input: GetSurchargesScopedInput
): Promise<SurchargeRowOut[]> {
  const out = await getSurchargesScopedWithMeta(input);
  return out.value;
}
