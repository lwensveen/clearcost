import { index, numeric, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../utils.js';
import { vatRateKindEnum } from '../enums.js';

export const vatOverridesTable = pgTable(
  'vat_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dest: varchar('dest', { length: 2 }).notNull(), // ISO-3166-1 alpha-2
    vatRateKind: vatRateKindEnum('vat_rate_kind').notNull().default('STANDARD'),
    hs6: varchar('hs6', { length: 6 }).notNull(), // digits only
    ratePct: numeric('rate_pct', { precision: 6, scale: 3 }).notNull(), // e.g., 5.000
    effectiveFrom: createTimestampColumn('effective_from', { defaultNow: true }),
    effectiveTo: createTimestampColumn('effective_to'),
    notes: text('notes'),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    uxDestHs6From: uniqueIndex('ux_vat_overrides_dest_hs6_from').on(t.dest, t.hs6, t.effectiveFrom),
    idxDestHs6: index('idx_vat_overrides_dest_hs6').on(t.dest, t.hs6),
  })
);
