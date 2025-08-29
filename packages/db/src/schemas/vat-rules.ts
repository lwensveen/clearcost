import { index, numeric, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../utils.js';
import { vatBaseEnum, vatRateKindEnum } from '../enums.js';

export const vatRulesTable = pgTable(
  'vat_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dest: varchar('dest', { length: 2 }).notNull(),
    vatRateKind: vatRateKindEnum('vat_rate_kind').notNull().default('STANDARD'),
    ratePct: numeric('rate_pct', { precision: 6, scale: 3 }).notNull(),
    vatBase: vatBaseEnum('vat_base').notNull().default('CIF_PLUS_DUTY'),
    effectiveFrom: createTimestampColumn('effective_from', { defaultNow: true }),
    effectiveTo: createTimestampColumn('effective_to', { defaultNow: true, nullable: true }),
    notes: text('notes'),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => [
    uniqueIndex('vat_rules_dest_kind_from_uq').on(t.dest, t.vatRateKind, t.effectiveFrom),
    index('vat_rules_dest_kind_idx').on(t.dest, t.vatRateKind),
  ]
);
