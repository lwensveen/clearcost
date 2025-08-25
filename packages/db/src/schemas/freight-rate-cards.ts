import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { freightModeEnum, freightUnitEnum } from '../enums.js';
import { createTimestampColumn, defaultTimestampOptions } from '../utils.js';

export const freightRateCardsTable = pgTable(
  'freight_rate_cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    origin: varchar('origin', { length: 3 }).notNull(),
    dest: varchar('dest', { length: 3 }).notNull(),
    mode: freightModeEnum('mode').notNull(),
    unit: freightUnitEnum('unit').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    minCharge: numeric('min_charge', { precision: 12, scale: 2 }).default('0').notNull(),
    priceRounding: numeric('price_rounding', { precision: 12, scale: 2 }),
    volumetricDivisor: integer('volumetric_divisor'),
    carrier: varchar('carrier', { length: 64 }),
    service: varchar('service', { length: 64 }),
    effectiveFrom: createTimestampColumn('effective_from', { defaultNow: true }),
    effectiveTo: timestamp('effective_to', defaultTimestampOptions),
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
    idxCarrier: index('freight_cards_carrier_idx').on(t.carrier),
    idxService: index('freight_cards_service_idx').on(t.service),
  })
);
