import { db } from '@clearcost/db';
import { and, desc, eq, lte } from 'drizzle-orm';
import { vatOverridesTable } from '@clearcost/db/src/schemas/vat-overrides.js';
import { VatRateKind } from './utils.js';

/**
 * An HS6 override can:
 *  - specify an explicit ratePct (highest precedence), OR
 *  - suggest a rate kind to use (e.g., 'REDUCED') for this HS6,
 *  - carry its own effectiveFrom for auditability.
 *
 * Either `ratePct` or `kind` may be present; both may be present in some models,
 * in which case callers should prefer `ratePct`.
 */
export type VatOverrideRow = {
  ratePct?: number | null;
  vatRateKind?: VatRateKind | null;
  effectiveFrom: Date | null;
};

/**
 * Return the most recent override for (dest, hs6) active on `on`.
 * - If your table stores hs6 as TEXT, we do not coerce/left-pad; we trust the value you pass.
 * - If you later store ranges (e.g., chapter-level overrides), extend the WHERE clause.
 */
export async function getVatOverride(
  dest: string,
  hs6: string,
  on: Date
): Promise<VatOverrideRow | null> {
  const destISO2 = dest.toUpperCase();
  const hs6Code = String(hs6).trim(); // keep exact; caller should ensure /^\d{6}$/ upstream

  const [row] = await db
    .select({
      ratePct: vatOverridesTable.ratePct,
      vatRateKind: vatOverridesTable.vatRateKind,
      effectiveFrom: vatOverridesTable.effectiveFrom,
    })
    .from(vatOverridesTable)
    .where(
      and(
        eq(vatOverridesTable.dest, destISO2),
        eq(vatOverridesTable.hs6, hs6Code),
        lte(vatOverridesTable.effectiveFrom, on)
      )
    )
    .orderBy(desc(vatOverridesTable.effectiveFrom))
    .limit(1);

  if (!row) return null;

  return {
    ratePct: row.ratePct == null ? null : Number(row.ratePct),
    vatRateKind: (row.vatRateKind ?? null) as VatRateKind | null,
    effectiveFrom: row.effectiveFrom ?? null,
  };
}
