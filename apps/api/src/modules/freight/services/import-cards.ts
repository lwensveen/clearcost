import { db, freightRateCardsTable, freightRateStepsTable, provenanceTable } from '@clearcost/db';
import { eq, sql } from 'drizzle-orm';
import { sha256Hex } from '../../../lib/provenance.js';
import {
  FreightCardImportSchema,
  FreightCardsImportSchema,
  type FreightCardImport,
} from '@clearcost/types';

type ImportOpts = {
  batchSize?: number;
  importId?: string;
  makeSourceRef?: (card: FreightCardImport) => string | undefined;
};

const ymd = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function importFreightCards(cards: FreightCardImport[], opts: ImportOpts = {}) {
  const parsed = FreightCardsImportSchema.parse(cards);
  const items = parsed.map((card) => ({
    ...card,
    origin: card.origin.toUpperCase(),
    dest: card.dest.toUpperCase(),
    currency: (card.currency ?? 'USD').toUpperCase(),
  }));

  await db.transaction(async (tx) => {
    for (const card of items) {
      const inserted = await tx
        .insert(freightRateCardsTable)
        .values({
          origin: card.origin,
          dest: card.dest,
          freightMode: card.freightMode,
          freightUnit: card.freightUnit,
          currency: card.currency,
          effectiveFrom: card.effectiveFrom,
          effectiveTo: card.effectiveTo ?? undefined,
          notes: card.notes ?? undefined,
          minCharge: card.minCharge != null ? String(card.minCharge) : undefined,
          priceRounding: card.priceRounding != null ? String(card.priceRounding) : undefined,
          volumetricDivisor: card.volumetricDivisor ?? undefined,
        })
        .onConflictDoUpdate({
          target: [
            freightRateCardsTable.origin,
            freightRateCardsTable.dest,
            freightRateCardsTable.freightMode,
            freightRateCardsTable.freightUnit,
            freightRateCardsTable.effectiveFrom,
          ],
          set: {
            currency: card.currency,
            effectiveTo: card.effectiveTo ?? sql`NULL`,
            notes: card.notes ?? sql`NULL`,
            minCharge: card.minCharge != null ? String(card.minCharge) : sql`NULL`,
            priceRounding: card.priceRounding != null ? String(card.priceRounding) : sql`NULL`,
            volumetricDivisor: card.volumetricDivisor != null ? card.volumetricDivisor : sql`NULL`,
            updatedAt: new Date(),
          },
        })
        .returning({ id: freightRateCardsTable.id });

      const cardId = inserted[0]?.id;
      if (!cardId) throw new Error('Failed to upsert freight rate card (no id)');

      await tx.delete(freightRateStepsTable).where(eq(freightRateStepsTable.cardId, cardId));

      for (const step of card.steps) {
        await tx
          .insert(freightRateStepsTable)
          .values({
            cardId,
            uptoQty: String(step.uptoQty),
            pricePerUnit: String(step.pricePerUnit),
          })
          .onConflictDoUpdate({
            target: [freightRateStepsTable.cardId, freightRateStepsTable.uptoQty],
            set: { pricePerUnit: String(step.pricePerUnit), updatedAt: new Date() },
          });
      }

      if (opts.importId) {
        const canonical = {
          origin: card.origin,
          dest: card.dest,
          freightMode: card.freightMode,
          freightUnit: card.freightUnit,
          currency: card.currency,
          effectiveFrom: ymd(card.effectiveFrom),
          effectiveTo: ymd(card.effectiveTo ?? null),
          minCharge: card.minCharge ?? null,
          priceRounding: card.priceRounding ?? null,
          volumetricDivisor: card.volumetricDivisor ?? null,
          notes: card.notes ?? null,
          steps: card.steps.map((s) => ({ uptoQty: s.uptoQty, pricePerUnit: s.pricePerUnit })),
        };

        await tx.insert(provenanceTable).values({
          importId: opts.importId,
          resourceType: 'freight_card',
          resourceId: cardId,
          sourceRef: opts.makeSourceRef?.(card),
          rowHash: sha256Hex(JSON.stringify(canonical)),
        });
      }
    }
  });

  return { ok: true as const, count: items.length };
}
