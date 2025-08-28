import { db, vatRulesTable } from '@clearcost/db';
import { and, desc, eq, lte } from 'drizzle-orm';
import { CountryVatRow, VatRateKind } from './utils.js';

/**
 * Your calculator only uses these two bases today.
 * If a country row ever stores something else (e.g., 'FOB'),
 * we normalize to 'CIF_PLUS_DUTY' below to avoid surprising downstream math.
 */
export type VatBase = 'CIF' | 'CIF_PLUS_DUTY';

/** Normalize any DB base value into a safe calculator base. */
function normalizeBase(base: unknown): VatBase {
  return base === 'CIF' ? 'CIF' : 'CIF_PLUS_DUTY';
}

/**
 * Fetch the most recent VAT duty_rule for a destination and kind that is active on `on`.
 * - Defaults to kind = 'STANDARD'
 * - Chooses the row with the greatest effectiveFrom <= `on`
 * - Returns numeric fields coerced to numbers for convenience
 */
export async function getVat(
  dest: string,
  on: Date,
  kind: VatRateKind = 'STANDARD'
): Promise<CountryVatRow | null> {
  const destISO2 = dest.toUpperCase();

  const [row] = await db
    .select({
      ratePct: vatRulesTable.ratePct,
      vatBase: vatRulesTable.vatBase,
      vatRateKind: vatRulesTable.vatRateKind,
      effectiveFrom: vatRulesTable.effectiveFrom,
    })
    .from(vatRulesTable)
    .where(
      and(
        eq(vatRulesTable.dest, destISO2),
        eq(vatRulesTable.vatRateKind, kind),
        lte(vatRulesTable.effectiveFrom, on)
      )
    )
    .orderBy(desc(vatRulesTable.effectiveFrom))
    .limit(1);

  if (!row) return null;

  return {
    ratePct: Number(row.ratePct),
    vatBase: normalizeBase(row.vatBase),
    vatRateKind: row.vatRateKind as VatRateKind,
    effectiveFrom: row.effectiveFrom ?? null,
  };
}
