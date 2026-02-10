import { db, freightRateCardsTable, freightRateStepsTable } from '@clearcost/db';
import { and, desc, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { LookupResult } from '../../../lib/lookup-meta.js';
import { freightLaneLookupCandidates } from './lane-country-code.js';

export type FreightLookupInput = {
  origin: string;
  dest: string;
  freightMode: 'air' | 'sea';
  freightUnit: 'kg' | 'm3';
  qty: number;
  on: Date;
};

export type FreightLookupValue = {
  currency: string;
  unit: 'kg' | 'm3';
  qty: number;
  price: number;
};

export type FreightLookupResult = LookupResult<FreightLookupValue | null>;

export async function getFreightWithMeta(opts: FreightLookupInput): Promise<FreightLookupResult> {
  try {
    const originCandidates = freightLaneLookupCandidates(opts.origin);
    const destCandidates = freightLaneLookupCandidates(opts.dest);

    if (originCandidates.length <= 0 || destCandidates.length <= 0) {
      return {
        value: null,
        meta: {
          status: 'error',
          note: `invalid freight lane input origin=${opts.origin} dest=${opts.dest}`,
        },
      };
    }

    const cardRows = await db
      .select({
        id: freightRateCardsTable.id,
        currency: freightRateCardsTable.currency,
        minCharge: freightRateCardsTable.minCharge,
        priceRounding: freightRateCardsTable.priceRounding,
        effectiveFrom: freightRateCardsTable.effectiveFrom,
      })
      .from(freightRateCardsTable)
      .where(
        and(
          inArray(freightRateCardsTable.origin, originCandidates),
          inArray(freightRateCardsTable.dest, destCandidates),
          eq(freightRateCardsTable.freightMode, opts.freightMode),
          eq(freightRateCardsTable.freightUnit, opts.freightUnit),
          lte(freightRateCardsTable.effectiveFrom, opts.on),
          or(
            isNull(freightRateCardsTable.effectiveTo),
            gt(freightRateCardsTable.effectiveTo, opts.on)
          )
        )
      )
      .orderBy(desc(freightRateCardsTable.effectiveFrom))
      .limit(1);

    const card = cardRows[0];
    if (!card) {
      const [coverage] = await db
        .select({ effectiveFrom: freightRateCardsTable.effectiveFrom })
        .from(freightRateCardsTable)
        .where(
          and(
            inArray(freightRateCardsTable.dest, destCandidates),
            eq(freightRateCardsTable.freightMode, opts.freightMode),
            eq(freightRateCardsTable.freightUnit, opts.freightUnit)
          )
        )
        .orderBy(desc(freightRateCardsTable.effectiveFrom))
        .limit(1);
      return coverage
        ? {
            value: null,
            meta: { status: 'no_match', effectiveFrom: coverage.effectiveFrom ?? null },
          }
        : { value: null, meta: { status: 'no_dataset' } };
    }

    const stepCandidate = await db
      .select({ uptoQty: freightRateStepsTable.uptoQty, price: freightRateStepsTable.pricePerUnit })
      .from(freightRateStepsTable)
      .where(
        and(
          eq(freightRateStepsTable.cardId, card.id),
          sql`${freightRateStepsTable.uptoQty} >= ${opts.qty}`
        )
      )
      .orderBy(freightRateStepsTable.uptoQty)
      .limit(1);

    const step =
      stepCandidate[0] ??
      (
        await db
          .select({
            uptoQty: freightRateStepsTable.uptoQty,
            price: freightRateStepsTable.pricePerUnit,
          })
          .from(freightRateStepsTable)
          .where(eq(freightRateStepsTable.cardId, card.id))
          .orderBy(desc(freightRateStepsTable.uptoQty))
          .limit(1)
      )[0];

    if (!step) {
      return {
        value: null,
        meta: { status: 'no_dataset', effectiveFrom: card.effectiveFrom ?? null },
      };
    }

    let price = Number(step.price) * opts.qty;
    if (card.minCharge != null) price = Math.max(price, Number(card.minCharge));
    if (card.priceRounding != null) {
      const r = Number(card.priceRounding);
      price = Math.round(price / r) * r;
    }

    return {
      value: { currency: card.currency, unit: opts.freightUnit, qty: opts.qty, price },
      meta: { status: 'ok', effectiveFrom: card.effectiveFrom ?? null },
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

export async function getFreight(opts: FreightLookupInput): Promise<FreightLookupValue | null> {
  const out = await getFreightWithMeta(opts);
  return out.value;
}
