import { index, numeric, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { dutyRuleEnum } from '../enums.js';
import { createTimestampColumn } from '../utils.js';

export const dutyRatesTable = pgTable(
  'duty_rates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dest: varchar('dest', { length: 2 }).notNull(), // destination ISO2
    partner: varchar('partner', { length: 2 }).notNull().default(''), // '' = MFN sentinel
    hs6: varchar('hs6', { length: 6 }).notNull(),
    ratePct: numeric('rate_pct', { precision: 6, scale: 3 }).notNull(), // e.g., 16.500
    dutyRule: dutyRuleEnum('duty_rule').default('mfn').notNull(), // MFN by default
    currency: varchar('currency', { length: 3 }).default('USD').notNull(), // display currency (optional)
    effectiveFrom: createTimestampColumn('effective_from', { defaultNow: true }),
    effectiveTo: createTimestampColumn('effective_to', { defaultNow: true, nullable: true }),
    notes: text('notes'),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    // single unique that lets MFN (partner='') and FTAs (partner='CA','MX',…) coexist
    byDestPartnerHs6RuleFrom: uniqueIndex('duty_rates_dest_partner_hs6_rule_from_uq').on(
      t.dest,
      t.partner,
      t.hs6,
      t.dutyRule,
      t.effectiveFrom
    ),
    idxDestHs6: index('duty_rates_dest_hs6_idx').on(t.dest, t.hs6),
  })
);
