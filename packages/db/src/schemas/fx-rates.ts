import { check, index, numeric, pgTable, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../utils.js';
import { sql } from 'drizzle-orm';

export const fxRatesTable = pgTable(
  'fx_rates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    base: varchar('base', { length: 3 }).notNull(), // e.g. USD
    quote: varchar('quote', { length: 3 }).notNull(), // e.g. EUR
    rate: numeric('rate', { precision: 18, scale: 8 }).notNull(), // base->quote
    asOf: createTimestampColumn('as_of', { defaultNow: true }),
    provider: varchar('provider', { length: 32 }).notNull().default('ecb'),
    sourceRef: varchar('source_ref', { length: 128 }), // e.g. ECB date, ETag, secondary API id
    ingestedAt: createTimestampColumn('ingested_at', { defaultNow: true }),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => [
    // Prevent duplicates for a provider, base, quote, and day
    uniqueIndex('ux_fx_provider_pair_asof').on(t.provider, t.base, t.quote, t.asOf),
    // provider-agnostic uniqueness
    uniqueIndex('ux_fx_pair_asof').on(t.base, t.quote, t.asOf),
    index('idx_fx_asof').on(t.asOf),
    // Prevent nonsensical rows like USD→USD
    check('chk_base_not_quote', sql`${t.base} <> ${t.quote}`),
  ]
);
