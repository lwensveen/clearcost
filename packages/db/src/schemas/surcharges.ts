import { index, numeric, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { surchargeCodeEnum } from '../enums.js';
import { createTimestampColumn } from '../utils.js';

export const surchargesTable = pgTable(
  'surcharges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dest: varchar('dest', { length: 2 }).notNull(), // destination market (e.g., 'US')
    origin: varchar('origin', { length: 2 }), // optional origin ISO2 (e.g., 'CN'); NULL = all origins
    hs6: varchar('hs6', { length: 6 }), // optional HS6 filter; NULL = all HS6
    code: surchargeCodeEnum('code').notNull(),
    fixedAmt: numeric('fixed_amt', { precision: 12, scale: 2 }),
    pctAmt: numeric('pct_amt', { precision: 6, scale: 3 }),
    notes: text('notes'),
    effectiveFrom: createTimestampColumn('effective_from', { defaultNow: true }),
    effectiveTo: createTimestampColumn('effective_to', { defaultNow: true }),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => [
    // Provider-agnostic idempotency across scope + code + version start
    uniqueIndex('surcharges_scope_code_from_uq').on(
      t.dest,
      t.origin,
      t.hs6,
      t.code,
      t.effectiveFrom
    ),
    // Hot lookup for selection (dest + scope + validity)
    index('surcharges_lookup_idx').on(
      t.dest,
      t.origin,
      t.hs6,
      t.code,
      t.effectiveFrom,
      t.effectiveTo
    ),
    // Convenience lookups (existing)
    uniqueIndex('surcharges_dest_code_from_uq').on(t.dest, t.code, t.effectiveFrom),
    index('surcharges_dest_code_idx').on(t.dest, t.code),
  ]
);
