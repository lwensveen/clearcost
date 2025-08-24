import { index, numeric, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { freightRateCards } from './freight-rate-cards.js';
import { createTimestampColumn } from '../utils.js';

export const freightRateSteps = pgTable(
  'freight_rate_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cardId: uuid('card_id')
      .notNull()
      .references(() => freightRateCards.id, { onDelete: 'cascade' }),
    uptoQty: numeric('upto_qty', { precision: 12, scale: 3 }).notNull(),
    pricePerUnit: numeric('price_per_unit', { precision: 12, scale: 4 }).notNull(),
    createdAt: createTimestampColumn('created_at'),
    updatedAt: createTimestampColumn('updated_at', true),
  },
  (t) => ({
    byCardUpto: uniqueIndex('freight_steps_card_upto_uq').on(t.cardId, t.uptoQty),
    idxCard: index('freight_steps_card_idx').on(t.cardId),
  })
);
