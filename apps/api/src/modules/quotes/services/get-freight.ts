import { db, freightRateCardsTable, freightRateStepsTable } from '@clearcost/db';
import { and, desc, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';

export async function getFreight(opts: {
  origin: string;
  dest: string;
  mode: 'air' | 'sea';
  unit: 'kg' | 'm3';
  qty: number;
  on: Date;
}) {
  const cardRows = await db
    .select({
      id: freightRateCardsTable.id,
      currency: freightRateCardsTable.currency,
    })
    .from(freightRateCardsTable)
    .where(
      and(
        eq(freightRateCardsTable.origin, opts.origin),
        eq(freightRateCardsTable.dest, opts.dest),
        eq(freightRateCardsTable.mode, opts.mode),
        eq(freightRateCardsTable.unit, opts.unit),
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

  const price = Number(step.price) * opts.qty;
  return { currency: card.currency, price };
}
