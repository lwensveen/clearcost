import { db, deMinimisTable } from '@clearcost/db';
import { and, desc, eq, gt, isNull, lte, or } from 'drizzle-orm';

export type DeMinimisThreshold = {
  currency: string; // ISO-4217
  value: number; // threshold amount in `currency`
  deMinimisBasis: 'INTRINSIC' | 'CIF';
};

export type DeMinimisBoth = {
  duty: DeMinimisThreshold | null;
  vat: DeMinimisThreshold | null;
};

/** Normalize any Date to midnight UTC (YYYY-MM-DD) to match effective windows. */
const toMidnightUTC = (d: Date) => new Date(d.toISOString().slice(0, 10));

/**
 * Fetch the active de minimis threshold for a given kind (DUTY or VAT) at a given date.
 * Window logic: effectiveFrom <= day AND (effectiveTo IS NULL OR effectiveTo > day)
 * (exclusive end to avoid overlaps).
 */
export async function getDeMinimisForKind(
  dest: string,
  kind: 'DUTY' | 'VAT',
  on = new Date()
): Promise<DeMinimisThreshold | null> {
  const day = toMidnightUTC(on);

  const [row] = await db
    .select({
      currency: deMinimisTable.currency,
      value: deMinimisTable.value,
      deMinimisBasis: deMinimisTable.deMinimisBasis,
      effectiveFrom: deMinimisTable.effectiveFrom,
    })
    .from(deMinimisTable)
    .where(
      and(
        eq(deMinimisTable.dest, dest.toUpperCase()),
        eq(deMinimisTable.deMinimisKind, kind),
        lte(deMinimisTable.effectiveFrom, day),
        or(isNull(deMinimisTable.effectiveTo), gt(deMinimisTable.effectiveTo, day)) // <-- exclusive end
      )
    )
    .orderBy(desc(deMinimisTable.effectiveFrom))
    .limit(1);

  if (!row) return null;

  const valueNum = Number(row.value);
  if (!Number.isFinite(valueNum)) return null;

  return {
    currency: row.currency,
    value: valueNum,
    deMinimisBasis: (row.deMinimisBasis as 'INTRINSIC' | 'CIF') ?? 'INTRINSIC',
  };
}

/** Fetch both DUTY and VAT de minimis thresholds active at `on`. */
export async function getDeMinimis(dest: string, on = new Date()): Promise<DeMinimisBoth> {
  const [duty, vat] = await Promise.all([
    getDeMinimisForKind(dest, 'DUTY', on),
    getDeMinimisForKind(dest, 'VAT', on),
  ]);
  return { duty, vat };
}
