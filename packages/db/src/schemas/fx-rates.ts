import { numeric, pgTable, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../utils.js';

export const fxRatesTable = pgTable(
  'fx_rates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    base: varchar('base', { length: 3 }).notNull(), // e.g. USD
    quote: varchar('quote', { length: 3 }).notNull(), // e.g. EUR
    rate: numeric('rate', { precision: 18, scale: 8 }).notNull(), // base->quote
    asOf: createTimestampColumn('as_of', { defaultNow: true }),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    uxPairAsOf: uniqueIndex('ux_fx_pair_asof').on(t.base, t.quote, t.asOf),
  })
);
