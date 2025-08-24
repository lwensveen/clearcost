import { numeric, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { deMinimisAppliesEnum } from '../enums.js';
import { createTimestampColumn } from '../utils.js';

export const deMinimis = pgTable('de_minimis', {
  id: uuid('id').primaryKey().defaultRandom(),
  dest: varchar('dest', { length: 2 }).notNull().unique(),
  currency: varchar('currency', { length: 3 }).notNull(), // currency of threshold (often dest currency)
  value: numeric('value', { precision: 14, scale: 2 }).notNull(),
  appliesTo: deMinimisAppliesEnum('applies_to').notNull().default('DUTY'),
  notes: text('notes'),
  createdAt: createTimestampColumn('created_at'),
  updatedAt: createTimestampColumn('updated_at', true),
});
