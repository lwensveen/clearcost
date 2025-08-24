import { index, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { freightModeEnum, freightUnitEnum } from '../enums.js';
import { createTimestampColumn } from '../utils.js';

export const freightRateCardsTable = pgTable(
  'freight_rate_cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    origin: varchar('origin', { length: 2 }).notNull(),
    dest: varchar('dest', { length: 2 }).notNull(),
    mode: freightModeEnum('mode').notNull(),
    unit: freightUnitEnum('unit').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    effectiveFrom: createTimestampColumn('effective_from', { defaultNow: true }),
    effectiveTo: createTimestampColumn('effective_to', { defaultNow: true }),
    notes: text('notes'),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    byLane: uniqueIndex('freight_cards_lane_uq').on(
      t.origin,
      t.dest,
      t.mode,
      t.unit,
      t.effectiveFrom
    ),
    idxLane: index('freight_cards_lane_idx').on(t.origin, t.dest, t.mode, t.unit),
  })
);
