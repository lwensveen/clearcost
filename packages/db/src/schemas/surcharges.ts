import { sql } from 'drizzle-orm';
import {
  date,
  index,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { surchargeCodeEnum } from '../enums.js';
import { createTimestampColumn } from '../utils.js';

export const surcharges = pgTable(
  'surcharges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dest: varchar('dest', { length: 2 }).notNull(),
    code: surchargeCodeEnum('code').notNull(),
    fixedAmt: numeric('fixed_amt', { precision: 12, scale: 2 }),
    pctAmt: numeric('pct_amt', { precision: 6, scale: 3 }),
    notes: text('notes'),
    effectiveFrom: date('effective_from')
      .notNull()
      .default(sql`CURRENT_DATE`),
    effectiveTo: date('effective_to'),
    createdAt: createTimestampColumn('created_at'),
    updatedAt: createTimestampColumn('updated_at', true),
  },
  (t) => ({
    byDestCodeFrom: uniqueIndex('surcharges_dest_code_from_uq').on(t.dest, t.code, t.effectiveFrom),
    idxDestCode: index('surcharges_dest_code_idx').on(t.dest, t.code),
  })
);
