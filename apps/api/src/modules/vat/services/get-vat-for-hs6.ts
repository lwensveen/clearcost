import type { VatBase } from './get-vat.js';
import { getVat } from './get-vat.js';
import { getVatOverride } from './get-vat-override.js';
import { CountryVatRow, VatRateKind } from './utils.js';

type Hs6OverrideRow = {
  /** If present, use this explicit rate and ignore kind. */
  ratePct?: number | null;
  /** If present (and ratePct is not given), use the country's rate for this kind. */
  vatRateKind?: VatRateKind | null;
  /** Optional provenance/effective date for the override duty_rule. */
  effectiveFrom?: Date | null;
};

export type VatForHs6 = {
  ratePct: number; // final VAT %
  vatBase: VatBase; // from country's STANDARD duty_rule
  source: 'override-rate' | 'override-kind' | 'default';
  effectiveFrom: Date | null;
};

/**
 * Resolve import VAT for a given destination + HS6 with override support.
 *
 * Priority:
 *  1) HS6 override with explicit ratePct -> use that rate
 *  2) HS6 override with kind -> use country rate for that kind
 *  3) Fallback to country's STANDARD rate
 *
 * The VAT base is always taken from the country's STANDARD duty_rule to keep it stable
 * across different reduced/zero regimes (unless you decide later to vary base by kind).
 */
export async function getVatForHs6(dest: string, hs6: string, on: Date): Promise<VatForHs6 | null> {
  // Fetch the HS6 override (if any) and the country's STANDARD VAT duty_rule in parallel.
  // STANDARD is our "anchor" for VAT base, regardless of which percentage we end up using.
  const [overrideRow, standardRow] = (await Promise.all([
    getVatOverride(dest, hs6, on), // -> Hs6OverrideRow | null
    getVat(dest, on, 'STANDARD'), // -> CountryVatRow | null
  ])) as [Hs6OverrideRow | null, CountryVatRow | null];

  // If we have neither override nor a country STANDARD duty_rule, we can't compute VAT.
  if (!overrideRow && !standardRow) return null;

  // Decide the base (always from the country's STANDARD duty_rule if available).
  // If a country genuinely lacks STANDARD in your data model, default to CIF_PLUS_DUTY.
  const vatBase: VatBase = standardRow?.vatBase ?? 'CIF_PLUS_DUTY';

  // Helper to pick an effectiveFrom date with sensible precedence.
  // When we use a percentage from an override, prefer the override's date; otherwise
  // use the source row's effectiveFrom; finally fall back to STANDARD's effectiveFrom.
  const pickEffectiveFrom = (primary?: Date | null, fallback?: Date | null): Date | null =>
    primary ?? fallback ?? standardRow?.effectiveFrom ?? null;

  // 1) HS6 override provides an explicit percentage -> use it.
  if (overrideRow?.ratePct != null && Number.isFinite(overrideRow.ratePct)) {
    return {
      ratePct: Number(overrideRow.ratePct),
      vatBase: vatBase,
      source: 'override-rate',
      effectiveFrom: pickEffectiveFrom(overrideRow.effectiveFrom, null),
    };
  }

  // 2) HS6 override provides a kind -> fetch country VAT for that kind.
  if (overrideRow?.vatRateKind) {
    const vatRateKind = overrideRow.vatRateKind as VatRateKind;
    const kindRow = await getVat(dest, on, vatRateKind); // -> CountryVatRow | null

    if (kindRow) {
      return {
        ratePct: Number(kindRow.ratePct),
        vatBase: vatBase, // still anchored to STANDARD's base
        source: 'override-kind',
        effectiveFrom: pickEffectiveFrom(overrideRow.effectiveFrom, kindRow.effectiveFrom),
      };
    }
    // If kind was suggested but the country has no such duty_rule, fall through to STANDARD.
  }

  // 3) Fallback: use the country's STANDARD duty_rule if available.
  if (standardRow) {
    return {
      ratePct: Number(standardRow.ratePct),
      vatBase: vatBase,
      source: 'default',
      effectiveFrom: standardRow.effectiveFrom ?? null,
    };
  }

  // Last-resort null: no usable data.
  return null;
}
