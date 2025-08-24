import { check, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createTimestampColumn } from '../utils.js';

export const hsCodesTable = pgTable(
  'hs_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hs6: varchar('hs6', { length: 6 }).notNull().unique(),
    title: text('title').notNull(),
    ahtn8: varchar('ahtn8', { length: 8 }),
    cn8: varchar('cn8', { length: 8 }),
    hts10: varchar('hts10', { length: 10 }),
    notes: text('notes'),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    chk_hs6_digits: check('hs6_is_digits', sql`${t.hs6}  ~ '^[0-9]{6}$'`),
    chk_ahtn8_digits: check(
      'ahtn8_is_digits',
      sql`${t.ahtn8} IS NULL OR ${t.ahtn8}  ~ '^[0-9]{8}$'`
    ),
    chk_cn8_digits: check('cn8_is_digits', sql`${t.cn8}  IS NULL OR ${t.cn8}   ~ '^[0-9]{8}$'`),
    chk_hts10_digits: check(
      'hts10_is_digits',
      sql`${t.hts10} IS NULL OR ${t.hts10} ~ '^[0-9]{10}$'`
    ),
  })
);
