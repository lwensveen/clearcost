import { db, freightRateCardsTable, freightRateStepsTable } from '@clearcost/db';
import { and, desc, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';

export async function getFreight(opts: {
  origin: string;
  dest: string;
  freightMode: 'air' | 'sea';
  freightUnit: 'kg' | 'm3';
  qty: number;
  on: Date;
}) {
  const cardRows = await db
    .select({
      id: freightRateCardsTable.id,
      currency: freightRateCardsTable.currency,
      minCharge: freightRateCardsTable.minCharge,
      priceRounding: freightRateCardsTable.priceRounding,
    })
    .from(freightRateCardsTable)
    .where(
      and(
        eq(freightRateCardsTable.origin, opts.origin),
        eq(freightRateCardsTable.dest, opts.dest),
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
  if (!card) return null;

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

  if (!step) return null;

  let price = Number(step.price) * opts.qty;
  if (card.minCharge != null) price = Math.max(price, Number(card.minCharge));
  if (card.priceRounding != null) {
    const r = Number(card.priceRounding);
    price = Math.round(price / r) * r;
  }

  return { currency: card.currency, unit: opts.freightUnit, qty: opts.qty, price };
}
