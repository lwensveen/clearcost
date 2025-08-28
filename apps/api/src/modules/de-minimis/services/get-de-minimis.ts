import { db, deMinimisTable } from '@clearcost/db';
import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';

export type DeMinimisThreshold = {
  currency: string; // ISO-4217
  value: number; // threshold amount in `currency`
  deMinimisBasis: 'INTRINSIC' | 'CIF'; // goods-only vs CIF
};

export type DeMinimisBoth = {
  duty: DeMinimisThreshold | null;
  vat: DeMinimisThreshold | null;
};

/** Normalize any Date to midnight UTC (YYYY-MM-DD) to match effective windows. */
const toMidnightUTC = (d: Date) => new Date(d.toISOString().slice(0, 10));

/**
 * Fetch the active de minimis threshold for a given kind (DUTY or VAT) at a given date.
 * Uses the (dest, kind, effective_from/To) window and returns the newest match.
 */
export async function getDeMinimisForKind(
  dest: string,
  kind: 'DUTY' | 'VAT',
  on = new Date()
): Promise<DeMinimisThreshold | null> {
  const day = toMidnightUTC(on);

  const [row] = await db
    .select()
    .from(deMinimisTable)
    .where(
      and(
        eq(deMinimisTable.dest, dest.toUpperCase()),
        eq(deMinimisTable.deMinimisKind, kind),
        lte(deMinimisTable.effectiveFrom, day),
        or(isNull(deMinimisTable.effectiveTo), gte(deMinimisTable.effectiveTo, day))
      )
    )
    .orderBy(desc(deMinimisTable.effectiveFrom))
    .limit(1);

  if (!row) return null;

  return {
    currency: row.currency,
    value: Number(row.value),
    deMinimisBasis: (row.deMinimisBasis as 'INTRINSIC' | 'CIF') ?? 'INTRINSIC',
  };
}

/**
 * Fetch both DUTY and VAT de minimis thresholds active at `on`.
 * Convenience wrapper around `getDeMinimisForKind`.
 */
export async function getDeMinimis(dest: string, on = new Date()): Promise<DeMinimisBoth> {
  const [duty, vat] = await Promise.all([
    getDeMinimisForKind(dest, 'DUTY', on),
    getDeMinimisForKind(dest, 'VAT', on),
  ]);
  return { duty, vat };
}
