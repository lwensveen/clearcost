import { index, numeric, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { dutyRuleEnum, dutySourceEnum } from '../enums.js';
import { createTimestampColumn } from '../utils.js';

export const dutyRatesTable = pgTable(
  'duty_rates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dest: varchar('dest', { length: 2 }).notNull(),
    partner: varchar('partner', { length: 2 }).notNull().default(''),
    hs6: varchar('hs6', { length: 6 }).notNull(),
    source: dutySourceEnum('source').notNull().default('official'),
    ratePct: numeric('rate_pct', { precision: 6, scale: 3 }).notNull(),
    dutyRule: dutyRuleEnum('duty_rule').default('mfn').notNull(),
    currency: varchar('currency', { length: 3 }).default('USD').notNull(),
    effectiveFrom: createTimestampColumn('effective_from', { defaultNow: true }),
    effectiveTo: createTimestampColumn('effective_to', { defaultNow: true, nullable: true }),
    notes: text('notes'),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    byDestPartnerHs6RuleFrom: uniqueIndex('duty_rates_dest_partner_hs6_rule_from_uq').on(
      t.dest,
      t.partner,
      t.hs6,
      t.dutyRule,
      t.effectiveFrom
    ),
    idxDestHs6: index('duty_rates_dest_hs6_idx').on(t.dest, t.hs6),
    idxSource: index('duty_rates_source_idx').on(t.source),
  })
);
