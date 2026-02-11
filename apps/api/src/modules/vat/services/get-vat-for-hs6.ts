import { db, vatOverridesTable, vatRulesTable } from '@clearcost/db';
import { and, desc, eq } from 'drizzle-orm';
import type { VatBase } from './get-vat.js';
import { getVat } from './get-vat.js';
import { getVatOverride } from './get-vat-override.js';
import type { LookupResult } from '../../../lib/lookup-meta.js';
import type { CountryVatRow, VatRateKind } from './utils.js';

type Hs6OverrideRow = {
  /** If present, use this explicit rate and ignore kind. */
  ratePct?: number | null;
  /** If present (and ratePct is not given), use the country's rate for this kind. */
  vatRateKind?: VatRateKind | null;
  /** Optional provenance/effective date for the override duty_rule. */
  effectiveFrom?: Date | null;
  source?: string | null;
  dataset?: string | null;
};

export type VatForHs6 = {
  ratePct: number; // final VAT %
  vatBase: VatBase; // from country's STANDARD duty_rule
  source: 'override-rate' | 'override-kind' | 'default';
  effectiveFrom: Date | null;
};

export type VatForHs6LookupResult = LookupResult<VatForHs6 | null>;
export type VatForHs6LookupOpts = {
  /**
   * MVP-only guardrail: restrict VAT lookup to official imported rows.
   */
  mvpOfficialOnly?: boolean;
};

const VAT_OUT_OF_SCOPE_DESTS = new Set(['US']);
const VAT_INTERNAL_SOURCE_LABELS = new Set(['default', 'override-rate', 'override-kind']);

function latestDate(values: Array<Date | null | undefined>): Date | null {
  let latest: Date | null = null;
  for (const value of values) {
    if (!value) continue;
    if (!latest || value.getTime() > latest.getTime()) latest = value;
  }
  return latest;
}

type VatDatasetCarrier = Record<string, unknown>;

export function resolveVatDatasetProvenance(
  ...rows: Array<VatDatasetCarrier | null | undefined>
): string | null {
  for (const row of rows) {
    if (!row) continue;
    const rawDataset = row.dataset;
    const dataset =
      typeof rawDataset === 'string' && rawDataset.trim().length > 0 ? rawDataset.trim() : null;
    if (dataset && !VAT_INTERNAL_SOURCE_LABELS.has(dataset)) return dataset;

    const rawSource = row.source;
    const source =
      typeof rawSource === 'string' && rawSource.trim().length > 0 ? rawSource.trim() : null;
    if (source && !VAT_INTERNAL_SOURCE_LABELS.has(source)) return source;
  }
  return null;
}

async function getVatCoverageForDestination(
  dest: string,
  hs6: string,
  opts: VatForHs6LookupOpts = {}
) {
  const sourceFilter = opts.mvpOfficialOnly ? 'official' : null;
  const [ruleRow, overrideRow] = await Promise.all([
    db
      .select({ effectiveFrom: vatRulesTable.effectiveFrom })
      .from(vatRulesTable)
      .where(
        and(
          eq(vatRulesTable.dest, dest),
          sourceFilter ? eq(vatRulesTable.source, sourceFilter) : undefined
        )
      )
      .orderBy(desc(vatRulesTable.effectiveFrom))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({ effectiveFrom: vatOverridesTable.effectiveFrom })
      .from(vatOverridesTable)
      .where(
        and(
          eq(vatOverridesTable.dest, dest),
          eq(vatOverridesTable.hs6, hs6),
          sourceFilter ? eq(vatOverridesTable.source, sourceFilter) : undefined
        )
      )
      .orderBy(desc(vatOverridesTable.effectiveFrom))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  const effectiveFrom = latestDate([ruleRow?.effectiveFrom, overrideRow?.effectiveFrom]);
  if (!ruleRow && !overrideRow) return null;

  return { effectiveFrom };
}

async function getLatestVatRuleEffectiveFrom(dest: string, opts: VatForHs6LookupOpts = {}) {
  const sourceFilter = opts.mvpOfficialOnly ? 'official' : null;
  const [row] = await db
    .select({ effectiveFrom: vatRulesTable.effectiveFrom })
    .from(vatRulesTable)
    .where(
      and(
        eq(vatRulesTable.dest, dest),
        sourceFilter ? eq(vatRulesTable.source, sourceFilter) : undefined
      )
    )
    .orderBy(desc(vatRulesTable.effectiveFrom))
    .limit(1);
  return row?.effectiveFrom ?? null;
}

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
export async function getVatForHs6WithMeta(
  dest: string,
  hs6: string,
  on: Date,
  opts: VatForHs6LookupOpts = {}
): Promise<VatForHs6LookupResult> {
  try {
    const destA2 = dest.toUpperCase();
    const sourceFilter = opts.mvpOfficialOnly ? 'official' : undefined;
    if (VAT_OUT_OF_SCOPE_DESTS.has(destA2)) {
      return {
        value: null,
        meta: {
          status: 'out_of_scope',
          note: 'Destination tax component is not modeled as import VAT.',
        },
      };
    }

    // Fetch the HS6 override (if any) and the country's STANDARD VAT duty_rule in parallel.
    // STANDARD is our "anchor" for VAT base, regardless of which percentage we end up using.
    const [overrideRow, standardRow] = (await Promise.all([
      getVatOverride(destA2, hs6, on, { source: sourceFilter }), // -> Hs6OverrideRow | null
      getVat(destA2, on, 'STANDARD', { source: sourceFilter }), // -> CountryVatRow | null
    ])) as [Hs6OverrideRow | null, CountryVatRow | null];

    // If we have neither override nor a country STANDARD duty_rule, we can't compute VAT.
    if (!overrideRow && !standardRow) {
      const coverage = await getVatCoverageForDestination(destA2, hs6, opts);
      return {
        value: null,
        meta: coverage
          ? { status: 'no_match', effectiveFrom: coverage.effectiveFrom }
          : { status: 'no_dataset' },
      };
    }

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
      const value = {
        ratePct: Number(overrideRow.ratePct),
        vatBase: vatBase,
        source: 'override-rate' as const,
        effectiveFrom: pickEffectiveFrom(overrideRow.effectiveFrom, null),
      };
      return {
        value,
        meta: {
          status: 'ok',
          dataset: resolveVatDatasetProvenance(overrideRow, standardRow),
          effectiveFrom: value.effectiveFrom,
        },
      };
    }

    // 2) HS6 override provides a kind -> fetch country VAT for that kind.
    if (overrideRow?.vatRateKind) {
      const vatRateKind = overrideRow.vatRateKind as VatRateKind;
      const kindRow = await getVat(destA2, on, vatRateKind, { source: sourceFilter }); // -> CountryVatRow | null

      if (kindRow) {
        const value = {
          ratePct: Number(kindRow.ratePct),
          vatBase: vatBase, // still anchored to STANDARD's base
          source: 'override-kind' as const,
          effectiveFrom: pickEffectiveFrom(overrideRow.effectiveFrom, kindRow.effectiveFrom),
        };
        return {
          value,
          meta: {
            status: 'ok',
            dataset: resolveVatDatasetProvenance(overrideRow, kindRow, standardRow),
            effectiveFrom: value.effectiveFrom,
          },
        };
      }
      // If kind was suggested but the country has no such duty_rule, fall through to STANDARD.
    }

    // 3) Fallback: use the country's STANDARD duty_rule if available.
    if (standardRow) {
      const value = {
        ratePct: Number(standardRow.ratePct),
        vatBase: vatBase,
        source: 'default' as const,
        effectiveFrom: standardRow.effectiveFrom ?? null,
      };
      return {
        value,
        meta: {
          status: 'ok',
          dataset: resolveVatDatasetProvenance(standardRow),
          effectiveFrom: value.effectiveFrom,
        },
      };
    }

    // Last-resort null: no usable data.
    const latestEffectiveFrom = await getLatestVatRuleEffectiveFrom(destA2, opts);
    return {
      value: null,
      meta: latestEffectiveFrom
        ? { status: 'no_match', effectiveFrom: latestEffectiveFrom }
        : { status: 'no_dataset' },
    };
  } catch (error: unknown) {
    return {
      value: null,
      meta: {
        status: 'error',
        note: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function getVatForHs6(dest: string, hs6: string, on: Date): Promise<VatForHs6 | null> {
  const out = await getVatForHs6WithMeta(dest, hs6, on);
  return out.value;
}
