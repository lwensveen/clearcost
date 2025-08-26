import { check, index, pgEnum, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
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
    hs6: varchar('hs6', { length: 6 })
      .notNull()
      .references(() => hsCodesTable.hs6, { onDelete: 'cascade', onUpdate: 'cascade' }),
    system: hsAliasSystemEnum('system').notNull(),
    code: varchar('code', { length: 14 }).notNull(), // digits only (no dots)
    title: text('title').notNull(),
    effectiveFrom: createTimestampColumn('effective_from', { defaultNow: true }),
    effectiveTo: createTimestampColumn('effective_to', { defaultNow: true }),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => [
    index('hs_alias_lookup_idx').on(t.system, t.code),
    index('hs_alias_hs6_idx').on(t.hs6),
    check('hs_alias_hs6_digits', sql`${t.hs6} ~ '^[0-9]{6}$'`),
    check('hs_alias_code_digits', sql`${t.code} ~ '^[0-9]{8,10}$'`),
  ]
);
