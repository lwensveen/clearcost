import {
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../utils.js';
import { dutyRatesTable } from './duty-rates.js';
import { dutyComponentTypeEnum } from '../enums.js';

export const dutyRateComponentsTable = pgTable(
  'duty_rate_components',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dutyRateId: uuid('duty_rate_id')
      .notNull()
      .references(() => dutyRatesTable.id, { onDelete: 'cascade' }),
    componentType: dutyComponentTypeEnum('component_type').notNull(),
    ratePct: numeric('rate_pct', { precision: 6, scale: 3 }),
    amount: numeric('amount', { precision: 14, scale: 6 }), // currency amount
    currency: varchar('currency', { length: 3 }), // e.g., "EUR", "CNY"
    uom: varchar('uom', { length: 32 }), // e.g., "kg", "100kg", "l"
    qualifier: varchar('qualifier', { length: 32 }), // e.g., "net", "gross"
    formula: jsonb('formula'),
    notes: text('notes'),
    effectiveFrom: createTimestampColumn('effective_from', { defaultNow: true }),
    effectiveTo: createTimestampColumn('effective_to', { defaultNow: true, nullable: true }),
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
