import { getCurrencyForCountry, type QuoteInput } from '@clearcost/types';
import { db, merchantProfilesTable, taxRegistrationsTable } from '@clearcost/db';
import { and, eq } from 'drizzle-orm';
import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json' with { type: 'json' };
import { EU_ISO2, volumeM3, volumetricKg } from '../utils.js';
import { resolveHs6 } from '../../hs-codes/services/resolve-hs6.js';
import { convertCurrencyWithMeta } from '../../fx/services/convert-currency.js';
import { getActiveDutyRateWithMeta } from '../../duty-rates/services/get-active-duty-rate.js';
import { getSurchargesScopedWithMeta } from '../../surcharges/services/get-surcharges.js';
import { getFreightWithMeta } from '../../freight/services/get-freight.js';
import { getVatForHs6WithMeta } from '../../vat/services/get-vat-for-hs6.js';
import { getCanonicalFxAsOf } from '../../fx/services/get-canonical-fx-asof.js';
import { evaluateDeMinimis } from '../../de-minimis/services/evaluate.js';
import {
  deriveQuoteConfidenceParts,
  overallConfidenceFrom,
  type QuoteConfidenceComponent,
} from './confidence.js';
import { toQuoteSourceMetadata } from './source-metadata.js';
import { getDatasetFreshnessSnapshot } from '../../health/services.js';

type Unit = 'kg' | 'm3';
const BASE_CCY = process.env.CURRENCY_BASE ?? 'USD';

countries.registerLocale(en);

const roundMoney = (n: number, ccy: string) => {
  const dp = ccy === 'JPY' ? 0 : 2;
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
};

function isStrictFreshnessEnabled() {
  return process.env.QUOTE_STRICT_FRESHNESS === '1';
}

function resolveDestinationCurrency(destCountryIso2: string): string {
  const iso2 = destCountryIso2.toUpperCase();
  const currency = getCurrencyForCountry(iso2);
  if (currency) return currency;
  throw Object.assign(
    new Error(`No ISO-4217 currency mapping configured for destination country ${iso2}`),
    {
      statusCode: 400,
      code: 'DEST_CURRENCY_UNMAPPED',
    }
  );
}

function toFreightIso3(countryCode: string): string {
  const normalized = String(countryCode ?? '')
    .trim()
    .toUpperCase();
  if (/^[A-Z]{3}$/.test(normalized)) return normalized;
  if (!/^[A-Z]{2}$/.test(normalized)) return normalized;
  const iso2 = normalized === 'UK' ? 'GB' : normalized;
  return countries.alpha2ToAlpha3(iso2) ?? normalized;
}

function toDutyPartnerIso2(countryCode: string): string {
  const normalized = String(countryCode ?? '')
    .trim()
    .toUpperCase();
  if (normalized === 'UK') return 'GB';
  if (/^[A-Z]{2}$/.test(normalized)) return normalized;
  if (/^[A-Z]{3}$/.test(normalized)) return countries.alpha3ToAlpha2(normalized) ?? normalized;
  return normalized;
}

function strictStaleComponentsFromSnapshot(
  snapshot: Awaited<ReturnType<typeof getDatasetFreshnessSnapshot>>
) {
  const out: Array<{ component: QuoteConfidenceComponent; dataset: string }> = [];

  const pushIfStale = (
    component: QuoteConfidenceComponent,
    dataset: keyof typeof snapshot.datasets
  ) => {
    if (snapshot.datasets[dataset].stale === true) {
      out.push({ component, dataset });
    }
  };

  pushIfStale('duty', 'duties');
  pushIfStale('vat', 'vat');
  pushIfStale('surcharges', 'surcharges');
  pushIfStale('fx', 'fx');

  return out;
}

export type QuoteCalcOpts = {
  /** Inject a pre-allocated freight amount already in destination currency. */
  freightInDestOverride?: number;
  /** Pin all FX conversions to this date (e.g., manifest-wide “as of”). */
  fxAsOf?: Date;
  /** Test/runtime override for strict freshness behavior (defaults to env flag). */
  strictFreshness?: boolean;
};

export async function quoteLandedCost(
  input: QuoteInput & { merchantId?: string },
  opts?: QuoteCalcOpts
) {
  const now = new Date();
  const fxAsOf = opts?.fxAsOf ?? (await getCanonicalFxAsOf());
  const destCurrency = resolveDestinationCurrency(input.dest);
  let fxMissingRate = false;

  const [profile, regs] = await Promise.all([
    input.merchantId
      ? db
          .select()
          .from(merchantProfilesTable)
          .where(eq(merchantProfilesTable.ownerId, input.merchantId))
          .limit(1)
          .then((r) => r[0])
      : Promise.resolve(undefined),
    input.merchantId
      ? db
          .select()
          .from(taxRegistrationsTable)
          .where(
            and(
              eq(taxRegistrationsTable.ownerId, input.merchantId),
              eq(taxRegistrationsTable.isActive, true)
            )
          )
      : Promise.resolve([] as Array<{ jurisdiction: string; scheme: string }>),
  ]);

  const wantsCheckoutVAT =
    (profile?.collectVatAtCheckout ?? 'auto') !== 'never' &&
    EU_ISO2.has(input.dest) &&
    regs.some((r) => r.jurisdiction === 'EU' && r.scheme?.toUpperCase() === 'IOSS');

  const hs6 = await resolveHs6(input.categoryKey, input.hs6);

  const volKg = volumetricKg(input.dimsCm);
  const chargeableKg = input.mode === 'air' ? Math.max(input.weightKg, volKg) : input.weightKg;
  const qty = input.mode === 'air' ? chargeableKg : volumeM3(input.dimsCm);
  const unit: Unit = input.mode === 'air' ? 'kg' : 'm3';

  const freightLookup = await getFreightWithMeta({
    // Quote API uses ISO2 lanes while freight cards are keyed by ISO3.
    origin: toFreightIso3(input.origin),
    dest: toFreightIso3(input.dest),
    freightMode: input.mode,
    freightUnit: unit,
    qty,
    on: now,
  });
  const freightRow = freightLookup.value;

  let freightInDest = opts?.freightInDestOverride ?? 0;
  if (opts?.freightInDestOverride == null) {
    const freightFx = await convertCurrencyWithMeta(
      freightRow?.price ?? 0,
      BASE_CCY,
      destCurrency,
      { on: fxAsOf, strict: true }
    );
    freightInDest = freightFx.amount;
    fxMissingRate ||= freightFx.meta.missingRate;
  }

  const itemDestFx = await convertCurrencyWithMeta(
    input.itemValue.amount,
    input.itemValue.currency,
    destCurrency,
    { on: fxAsOf, strict: true }
  );
  const itemValDest = itemDestFx.amount;
  fxMissingRate ||= itemDestFx.meta.missingRate;

  const CIF = itemValDest + freightInDest;

  // De minimis decision (FX-pinned and CIF-based)
  const dem = await evaluateDeMinimis({
    dest: input.dest,
    destCurrency,
    goodsDest: itemValDest,
    freightDest: freightInDest,
    fxAsOf,
  });

  const dutyLookup = await getActiveDutyRateWithMeta(input.dest, hs6, now, {
    partner: toDutyPartnerIso2(input.origin),
  });
  const dutyRow = dutyLookup.value;
  const vatLookup = await getVatForHs6WithMeta(input.dest, hs6, now);
  const vatInfo = vatLookup.value; // { ratePct, base, source, effectiveFrom }

  // -----------------
  // Duty (MFN first)
  // -----------------
  let duty = 0;
  if (!dem.suppressDuty) {
    const rate = dutyRow ? Number(dutyRow.ratePct) : 0;
    duty = (rate / 100) * CIF;
  }

  // -----------------
  // VAT / IOSS logic
  // -----------------
  const itemEurFx = await convertCurrencyWithMeta(itemValDest, destCurrency, 'EUR', {
    on: fxAsOf,
    strict: true,
  });
  const itemValEUR = itemEurFx.amount;
  fxMissingRate ||= itemEurFx.meta.missingRate;
  const iossEligible = wantsCheckoutVAT && itemValEUR <= 150;

  let vat = 0;
  let checkoutVAT = 0;

  if (iossEligible) {
    // IOSS: VAT collected at checkout on goods (and optionally shipping)
    const checkoutRate = (vatInfo ? Number(vatInfo.ratePct) : 0) / 100;
    const chargeShippingAtCheckout = profile?.chargeShippingAtCheckout ?? false;
    const checkoutVatBase = itemValDest + (chargeShippingAtCheckout ? freightInDest : 0);
    checkoutVAT = checkoutRate * checkoutVatBase;
  } else if (!dem.suppressVAT) {
    // Import VAT at border unless de minimis suppresses VAT
    const base = (vatInfo?.vatBase as 'CIF' | 'CIF_PLUS_DUTY') ?? 'CIF_PLUS_DUTY';
    const vatBase = base === 'CIF_PLUS_DUTY' ? CIF + duty : CIF;
    const vatRate = (vatInfo ? Number(vatInfo.ratePct) : 0) / 100;
    vat = vatRate * vatBase;
  }

  // -----------------
  // Surcharges/fees
  // -----------------
  const surchargeLookup = await getSurchargesScopedWithMeta({
    dest: input.dest,
    origin: input.origin,
    hs6,
    on: now,
  });
  const sur = surchargeLookup.value;
  const feesFixed = sur.reduce((s, r) => s + (r.fixedAmt ?? 0), 0);
  const feesPct = sur.reduce((s, r) => s + (r.pctAmt ?? 0), 0) * (CIF / 100);
  const fees = feesFixed + feesPct;

  // -----------------
  // Output assembly
  // -----------------
  const incoterm = (profile?.defaultIncoterm ?? 'DAP').toUpperCase() as 'DDP' | 'DAP';
  const currency = destCurrency;

  const components = {
    CIF: roundMoney(CIF, currency),
    duty: roundMoney(duty, currency),
    vat: roundMoney(vat, currency),
    fees: roundMoney(fees, currency),
    ...(checkoutVAT ? { checkoutVAT: roundMoney(checkoutVAT, currency) } : {}),
  };

  const total = roundMoney(
    components.CIF +
      components.duty +
      components.vat +
      components.fees +
      (components.checkoutVAT ?? 0),
    currency
  );

  // Policy text prioritizes de minimis messaging, then IOSS, then standard
  const policy =
    dem.suppressDuty || dem.suppressVAT
      ? dem.suppressDuty && dem.suppressVAT
        ? 'De minimis: duty & VAT not charged at import.'
        : dem.suppressDuty
          ? 'De minimis: duty not charged at import.'
          : 'De minimis: VAT not charged at import.'
      : iossEligible
        ? 'IOSS: VAT collected at checkout; no import VAT due.'
        : 'Standard import tax rules apply.';

  let confidence = deriveQuoteConfidenceParts({
    statuses: {
      duty: dutyLookup.meta.status,
      vat: vatLookup.meta.status,
      surcharges: surchargeLookup.meta.status,
      freight: freightLookup.meta.status,
    },
    fxMissingRate,
    freightOverridden: opts?.freightInDestOverride != null,
  });

  let strictFreshnessNote: string | null = null;
  const strictFreshnessEnabled = opts?.strictFreshness ?? isStrictFreshnessEnabled();
  if (strictFreshnessEnabled) {
    const strictStale = strictStaleComponentsFromSnapshot(await getDatasetFreshnessSnapshot());
    if (strictStale.length > 0) {
      const componentConfidence = { ...confidence.componentConfidence };
      const missing = new Set<QuoteConfidenceComponent>(confidence.missingComponents);
      for (const { component } of strictStale) {
        componentConfidence[component] = 'missing';
        missing.add(component);
      }
      confidence = {
        componentConfidence,
        missingComponents: [...missing],
        overallConfidence: overallConfidenceFrom(componentConfidence),
      };
      strictFreshnessNote = `Strict freshness mode: stale datasets (${strictStale
        .map((entry) => entry.dataset)
        .join(', ')}).`;
    }
  }

  const surchargeCodes = [
    ...new Set(
      sur
        .map((row) => (typeof row.surchargeCode === 'string' ? row.surchargeCode : ''))
        .filter((code) => code.length > 0)
    ),
  ];
  const surchargeSourceRefs = [
    ...new Set(
      sur
        .map((row) => (typeof row.sourceRef === 'string' ? row.sourceRef : ''))
        .filter((sourceRef) => sourceRef.length > 0)
    ),
  ];
  const dutyEffectiveFrom = dutyRow?.effectiveFrom ? new Date(dutyRow.effectiveFrom) : null;
  const vatEffectiveFrom = vatInfo?.effectiveFrom ? new Date(vatInfo.effectiveFrom) : null;
  const freightModel: 'card' | 'override' =
    opts?.freightInDestOverride == null ? 'card' : 'override';

  return {
    fxAsOf,
    quote: {
      hs6,
      currency,
      chargeableKg,
      freight: components.CIF - itemValDest,
      deMinimis: {
        duty: dem.duty ?? null,
        vat: dem.vat ?? null,
        suppressDuty: dem.suppressDuty,
        suppressVAT: dem.suppressVAT,
      },
      components,
      total,
      guaranteedMax: roundMoney(total * 1.02, currency),
      policy: strictFreshnessNote ? `${policy} ${strictFreshnessNote}` : policy,
      incoterm,
      componentConfidence: confidence.componentConfidence,
      overallConfidence: confidence.overallConfidence,
      missingComponents: confidence.missingComponents,
      sources: {
        duty: toQuoteSourceMetadata({
          dataset: dutyLookup.meta.dataset,
          effectiveFrom: dutyLookup.meta.effectiveFrom,
        }),
        vat: toQuoteSourceMetadata({
          dataset: vatLookup.meta.dataset,
          effectiveFrom: vatLookup.meta.effectiveFrom,
        }),
        surcharges: toQuoteSourceMetadata({
          dataset: surchargeLookup.meta.dataset,
          effectiveFrom: surchargeLookup.meta.effectiveFrom,
        }),
      },
      explainability: {
        duty: {
          dutyRule: dutyRow?.dutyRule ?? null,
          partner: dutyRow?.partner ?? null,
          source: dutyRow?.source ?? null,
          effectiveFrom: dutyEffectiveFrom ? dutyEffectiveFrom.toISOString() : null,
          suppressedByDeMinimis: dem.suppressDuty,
        },
        vat: {
          source: vatInfo?.source ?? null,
          vatBase: vatInfo?.vatBase ?? null,
          effectiveFrom: vatEffectiveFrom ? vatEffectiveFrom.toISOString() : null,
          checkoutCollected: iossEligible,
          suppressedByDeMinimis: dem.suppressVAT,
        },
        deMinimis: {
          suppressDuty: dem.suppressDuty,
          suppressVAT: dem.suppressVAT,
          dutyBasis: dem.duty?.deMinimisBasis ?? null,
          vatBasis: dem.vat?.deMinimisBasis ?? null,
        },
        surcharges: {
          appliedCodes: surchargeCodes,
          appliedCount: sur.length,
          sourceRefs: surchargeSourceRefs,
        },
        freight: {
          model: freightModel,
          lookupStatus: freightLookup.meta.status,
          unit,
          qty,
        },
      },
    },
  };
}
