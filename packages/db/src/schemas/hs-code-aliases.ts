import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { hsCodesTable } from './hs-codes.js';
import { createTimestampColumn } from '../utils.js';

export const hsAliasSystemEnum = pgEnum('hs_alias_system', [
  'CN8',
  'TARIC10',
  'HTS10',
  'UK10',
  'AHTN8',
]);

export const hsCodeAliasesTable = pgTable(
  'hs_code_aliases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hs6: varchar('hs6', { length: 6 }).references(() => hsCodesTable.hs6, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
    system: hsAliasSystemEnum('system').notNull(),
    code: varchar('code', { length: 14 }).notNull(),
    title: text('title').notNull(),
    chapter: integer('chapter').notNull(),
    heading4: varchar('heading4', { length: 4 }).notNull(),
    isSpecial: boolean('is_special').notNull().default(false),
    effectiveFrom: createTimestampColumn('effective_from', { defaultNow: true }),
    effectiveTo: createTimestampColumn('effective_to', { defaultNow: true }),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => [
    uniqueIndex('hs_alias_sys_code_unique').on(t.system, t.code),
    index('hs_alias_hs6_idx').on(t.hs6),
    index('hs_alias_chapter_idx').on(t.chapter),
    index('hs_alias_heading4_idx').on(t.heading4),
    index('hs_alias_is_special_idx').on(t.isSpecial),
    check('hs_alias_code_digits', sql`${t.code} ~ '^[0-9]{8,10}$'`),
    check('hs_alias_heading4_digits', sql`${t.heading4} ~ '^[0-9]{4}$'`),
    check('hs_alias_chapter_range', sql`${t.chapter} BETWEEN 1 AND 99`),
    check('hs_alias_is_special_rule', sql`${t.isSpecial} = (${t.chapter} >= 98)`),
    check(
      'hs_alias_hs6_rule',
      sql`(
        (${t.chapter} >= 98 AND ${t.hs6} IS NULL) OR
        (${t.chapter} BETWEEN 1 AND 97 AND ${t.hs6} IS NOT NULL)
      )`
    ),
  ]
);
