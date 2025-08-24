import { boolean, index, jsonb, numeric, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../utils.js';

export const auditQuotesTable = pgTable(
  'audit_quotes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    laneOrigin: varchar('lane_origin', { length: 2 }).notNull(),
    laneDest: varchar('lane_dest', { length: 2 }).notNull(),
    hs6: varchar('hs6', { length: 6 }).notNull(),
    itemValue: numeric('item_value', { precision: 14, scale: 2 }).notNull(),
    itemCurrency: varchar('item_currency', { length: 3 }).notNull(),
    dimsCm: jsonb('dims_cm').notNull(), // {l,w,h}
    weightKg: numeric('weight_kg', { precision: 10, scale: 3 }).notNull(),
    chargeableKg: numeric('chargeable_kg', { precision: 10, scale: 3 }),
    freight: numeric('freight', { precision: 14, scale: 2 }),
    dutyQuoted: numeric('duty_quoted', { precision: 14, scale: 2 }),
    vatQuoted: numeric('vat_quoted', { precision: 14, scale: 2 }),
    feesQuoted: numeric('fees_quoted', { precision: 14, scale: 2 }),
    totalQuoted: numeric('total_quoted', { precision: 14, scale: 2 }),
    // Post-clearance actuals for drift analysis
    dutyActual: numeric('duty_actual', { precision: 14, scale: 2 }),
    vatActual: numeric('vat_actual', { precision: 14, scale: 2 }),
    feesActual: numeric('fees_actual', { precision: 14, scale: 2 }),
    totalActual: numeric('total_actual', { precision: 14, scale: 2 }),
    // Flags & metadata
    lowConfidence: boolean('low_confidence').default(false).notNull(),
    notes: text('notes'),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    idxLaneHs: index('audit_lane_hs_idx').on(t.laneOrigin, t.laneDest, t.hs6),
    idxCreated: index('audit_created_idx').on(t.createdAt),
  })
);
