import { check, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createTimestampColumn } from '../utils.js';

export const hsCodesTable = pgTable(
  'hs_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hs6: varchar('hs6', { length: 6 }).notNull().unique(),
    title: text('title').notNull(),
    notes: text('notes'),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    chk_hs6_digits: check('hs6_is_digits', sql`${t.hs6} ~ '^[0-9]{6}$'`),
  })
);
