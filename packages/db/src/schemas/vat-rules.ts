import { index, numeric, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { vatBaseEnum } from '../enums.js';
import { createTimestampColumn } from '../utils.js';

export const vatRulesTable = pgTable(
  'vat_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dest: varchar('dest', { length: 2 }).notNull(),
    ratePct: numeric('rate_pct', { precision: 6, scale: 3 }).notNull(),
    base: vatBaseEnum('base').notNull().default('CIF_PLUS_DUTY'),
    effectiveFrom: createTimestampColumn('effective_from', { defaultNow: true }),
    effectiveTo: createTimestampColumn('effective_to'),
    notes: text('notes'),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    uxDestFrom: uniqueIndex('ux_vat_dest_from').on(t.dest, t.effectiveFrom),
    idxDest: index('idx_vat_dest').on(t.dest),
  })
);
