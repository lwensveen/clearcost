import {
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../utils.js';
import { dutyRatesTable } from './duty-rates.js';

export const dutyComponentTypeEnum = pgEnum('duty_component_type', [
  'advalorem', // % of customs value
  'specific', // amount per unit (e.g., EUR/kg)
  'minimum', // floor (e.g., min EUR/100kg)
  'maximum', // ceiling (e.g., max EUR/100kg)
  'other', // fallback (rare edge cases / formulas)
]);

export const dutyRateComponentsTable = pgTable(
  'duty_rate_components',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Parent duty rate
    dutyRateId: uuid('duty_rate_id')
      .notNull()
      .references(() => dutyRatesTable.id, { onDelete: 'cascade' }),
    componentType: dutyComponentTypeEnum('component_type').notNull(),
    // Ad-valorem component
    ratePct: numeric('rate_pct', { precision: 6, scale: 3 }), // e.g. 16.500
    // Specific / min / max component
    amount: numeric('amount', { precision: 14, scale: 6 }), // e.g. 3.700000
    currency: varchar('currency', { length: 3 }), // e.g. "EUR"
    uom: varchar('uom', { length: 32 }), // e.g. "kg", "item", "hl"
    qualifier: varchar('qualifier', { length: 32 }), // e.g. "net", "gross", "100kg"
    formula: jsonb('formula'), // optional JSON structure for complex expressions
    notes: text('notes'),
    effectiveFrom: createTimestampColumn('effective_from', { defaultNow: true }),
    effectiveTo: createTimestampColumn('effective_to', { defaultNow: true }),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    idxByDutyRate: index('duty_rate_components_duty_rate_id_idx').on(t.dutyRateId),
    idxByType: index('duty_rate_components_type_idx').on(t.componentType),
    dedupe: uniqueIndex('duty_rate_components_dedupe_uq').on(
      t.dutyRateId,
      t.componentType,
      t.ratePct,
      t.amount,
      t.currency,
      t.uom,
      t.qualifier,
      t.effectiveFrom
    ),
  })
);
