import { db, dutyRateComponentsTable } from '@clearcost/db';
import { and, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { convertCurrencyWithMeta } from '../../fx/services/convert-currency.js';

/** Shipment context you’ll know at quote time */
export type DutyComputeContext = {
  /** customs value in DEST currency */
  customsValueDest: number;
  /** number of items/pairs/etc (used if component uom is 'item'/'unit'/'pair') */
  quantity?: number;
  /** net weight in kg (used if uom is 'kg' or '100kg') */
  netKg?: number;
  /** liters (used if uom is 'l' / 'liter') */
  liters?: number;
};

/** Minimal shape we need from duty_rate_components */
export type DutyComponent = {
  componentType: 'advalorem' | 'specific' | 'minimum' | 'maximum' | 'other';
  ratePct?: number | null; // 12 for 12%
  amount?: number | null; // specific/min/max amount in DEST currency
  currency?: string | null; // optional; assume already in dest currency unless you add FX
  uom?: string | null; // 'kg' | '100kg' | 'item' | 'pair' | 'l' | ...
  qualifier?: string | null; // optional text like 'net'
};

/** Compute duty from components. Returns total duty and effective ad-valorem ratio. */
export type DutyMissingContextInput = 'quantity' | 'netKg' | 'liters' | 'uom';

export function computeDutyFromComponents(
  ctx: DutyComputeContext,
  comps: DutyComponent[]
): { duty: number; effectivePct: number; missingInputs: DutyMissingContextInput[] } {
  const customsValueDest = Number(ctx.customsValueDest);
  const quantity = ctx.quantity;
  const netKg = ctx.netKg;
  const liters = ctx.liters;

  const missing = new Set<DutyMissingContextInput>();

  const uomFactor = (
    component: DutyComponent
  ): { factor: number; missingInput: DutyMissingContextInput | null } => {
    const u = String(component.uom ?? '')
      .trim()
      .toLowerCase();
    if (u === 'kg') {
      return Number.isFinite(netKg)
        ? { factor: Number(netKg), missingInput: null }
        : { factor: 0, missingInput: 'netKg' };
    }
    if (u === '100kg') {
      return Number.isFinite(netKg)
        ? { factor: Number(netKg) / 100, missingInput: null }
        : { factor: 0, missingInput: 'netKg' };
    }
    if (u === 'l' || u === 'liter' || u === 'litre') {
      return Number.isFinite(liters)
        ? { factor: Number(liters), missingInput: null }
        : { factor: 0, missingInput: 'liters' };
    }
    if (u === 'item' || u === 'unit' || u === 'pair') {
      return Number.isFinite(quantity)
        ? { factor: Number(quantity), missingInput: null }
        : { factor: 0, missingInput: 'quantity' };
    }
    return { factor: 0, missingInput: 'uom' };
  };

  let adval = 0;
  let specific = 0;
  let minFloor = 0;
  let maxCeil = Infinity;

  for (const c of comps) {
    if (c.componentType === 'advalorem' && c.ratePct != null) {
      adval += (c.ratePct / 100) * customsValueDest;
    } else if (c.componentType === 'specific' && c.amount != null) {
      const factor = uomFactor(c);
      if (factor.missingInput) {
        missing.add(factor.missingInput);
        continue;
      }
      specific += c.amount * factor.factor;
    } else if (c.componentType === 'minimum' && c.amount != null) {
      const factor = uomFactor(c);
      if (factor.missingInput) {
        missing.add(factor.missingInput);
        continue;
      }
      minFloor = Math.max(minFloor, c.amount * factor.factor);
    } else if (c.componentType === 'maximum' && c.amount != null) {
      const factor = uomFactor(c);
      if (factor.missingInput) {
        missing.add(factor.missingInput);
        continue;
      }
      maxCeil = Math.min(maxCeil, c.amount * factor.factor);
    }
  }

  let duty = adval + specific;
  if (minFloor > 0) duty = Math.max(duty, minFloor);
  if (maxCeil < Infinity) duty = Math.min(duty, maxCeil);

  const effectivePct = customsValueDest > 0 ? duty / customsValueDest : 0;
  return { duty, effectivePct, missingInputs: [...missing] };
}

function normalizeCurrency(code: string | null | undefined): string | null {
  const normalized = String(code ?? '')
    .trim()
    .toUpperCase();
  if (!normalized) return null;
  if (/^[A-Z]{3}$/.test(normalized)) return normalized;
  throw Object.assign(new Error(`Invalid duty component currency code "${normalized}"`), {
    statusCode: 500,
    code: 'DUTY_COMPONENT_CURRENCY_INVALID',
  });
}

/**
 * Convenience: load components for a duty rate and compute. If there are no components,
 * fall back to the parent ad-valorem percentage (if provided).
 */
export async function computeDutyForRateId(
  dutyRateId: string,
  ctx: DutyComputeContext,
  opts?: {
    fallbackRatePct?: number; // e.g. Number(parentRow.ratePct)
    on?: Date;
    fxAsOf?: Date;
    destCurrency?: string;
  }
): Promise<{
  duty: number;
  effectivePct: number;
  usedComponents: boolean;
  fxMissingRate: boolean;
  contextMissing: boolean;
  missingInputs: DutyMissingContextInput[];
}> {
  const on = opts?.on ?? new Date();
  const rows = await db
    .select({
      componentType: dutyRateComponentsTable.componentType,
      ratePct: dutyRateComponentsTable.ratePct,
      amount: dutyRateComponentsTable.amount,
      currency: dutyRateComponentsTable.currency,
      uom: dutyRateComponentsTable.uom,
      qualifier: dutyRateComponentsTable.qualifier,
      effectiveFrom: dutyRateComponentsTable.effectiveFrom,
      effectiveTo: dutyRateComponentsTable.effectiveTo,
    })
    .from(dutyRateComponentsTable)
    .where(
      and(
        eq(dutyRateComponentsTable.dutyRateId, dutyRateId),
        lte(dutyRateComponentsTable.effectiveFrom, on),
        or(isNull(dutyRateComponentsTable.effectiveTo), gt(dutyRateComponentsTable.effectiveTo, on))
      )
    );

  const destCurrency = normalizeCurrency(opts?.destCurrency ?? null);
  let fxMissingRate = false;

  const comps: DutyComponent[] = rows
    .map((r) => {
      const componentType = r.componentType as DutyComponent['componentType'];
      const parsedRatePct = r.ratePct != null ? Number(r.ratePct) : null;
      const parsedAmount = r.amount != null ? Number(r.amount) : null;
      const componentCurrency = normalizeCurrency(r.currency ?? null);

      return {
        componentType,
        ratePct: parsedRatePct,
        amount: parsedAmount,
        currency: componentCurrency,
        uom: r.uom ?? null,
        qualifier: r.qualifier ?? null,
      };
    })
    .filter((c) =>
      c.componentType === 'advalorem'
        ? c.ratePct != null
        : c.componentType === 'other'
          ? false
          : c.amount != null
    );

  const convertedComps: DutyComponent[] = [];
  for (const component of comps) {
    if (component.amount == null) {
      convertedComps.push(component);
      continue;
    }

    const sourceCurrency = normalizeCurrency(component.currency);
    if (!sourceCurrency || sourceCurrency === destCurrency || !destCurrency) {
      convertedComps.push(component);
      continue;
    }

    const fxOut = await convertCurrencyWithMeta(component.amount, sourceCurrency, destCurrency, {
      on: opts?.fxAsOf ?? on,
      strict: true,
    });
    fxMissingRate ||= fxOut.meta.missingRate;
    convertedComps.push({
      ...component,
      amount: fxOut.amount,
      currency: destCurrency,
    });
  }

  if (convertedComps.length > 0) {
    const res = computeDutyFromComponents(ctx, convertedComps);
    if (res.missingInputs.length === 0) {
      return { ...res, usedComponents: true, fxMissingRate, contextMissing: false };
    }

    const pct = opts?.fallbackRatePct != null ? Number(opts.fallbackRatePct) : null;
    if (pct != null && isFinite(pct)) {
      const duty = (pct / 100) * ctx.customsValueDest;
      return {
        duty,
        effectivePct: ctx.customsValueDest > 0 ? duty / ctx.customsValueDest : 0,
        usedComponents: false,
        fxMissingRate,
        contextMissing: true,
        missingInputs: res.missingInputs,
      };
    }

    return { ...res, usedComponents: true, fxMissingRate, contextMissing: true };
  }

  const pct = opts?.fallbackRatePct != null ? Number(opts.fallbackRatePct) : null;
  if (pct != null && isFinite(pct)) {
    const duty = (pct / 100) * ctx.customsValueDest;
    return {
      duty,
      effectivePct: ctx.customsValueDest > 0 ? duty / ctx.customsValueDest : 0,
      usedComponents: false,
      fxMissingRate,
      contextMissing: false,
      missingInputs: [],
    };
  }

  // Nothing to compute
  return {
    duty: 0,
    effectivePct: 0,
    usedComponents: false,
    fxMissingRate,
    contextMissing: false,
    missingInputs: [],
  };
}
