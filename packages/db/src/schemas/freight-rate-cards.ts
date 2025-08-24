import { sql } from 'drizzle-orm';
import { date, index, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { freightModeEnum, freightUnitEnum } from '../enums.js';
import { createTimestampColumn } from '../utils.js';

export const freightRateCards = pgTable(
  'freight_rate_cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    origin: varchar('origin', { length: 2 }).notNull(),
    dest: varchar('dest', { length: 2 }).notNull(),
    mode: freightModeEnum('mode').notNull(),
    unit: freightUnitEnum('unit').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    effectiveFrom: date('effective_from')
      .notNull()
      .default(sql`CURRENT_DATE`),
    effectiveTo: date('effective_to'),
    notes: text('notes'),
    createdAt: createTimestampColumn('created_at'),
    updatedAt: createTimestampColumn('updated_at', true),
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
