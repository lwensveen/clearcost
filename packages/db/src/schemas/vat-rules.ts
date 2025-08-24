import { numeric, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { vatBaseEnum } from '../enums.js';
import { createTimestampColumn } from '../utils.js';

export const vatRulesTable = pgTable('vat_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  dest: varchar('dest', { length: 2 }).notNull().unique(),
  ratePct: numeric('rate_pct', { precision: 5, scale: 2 }).notNull(),
  base: vatBaseEnum('base').notNull().default('CIF_PLUS_DUTY'),
  notes: text('notes'),
  createdAt: createTimestampColumn('created_at', { defaultNow: true }),
  updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
});
