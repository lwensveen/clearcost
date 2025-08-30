import { index, numeric, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import {
  surchargeApplyLevelEnum,
  surchargeCodeEnum,
  surchargeRateTypeEnum,
  surchargeValueBasisEnum,
  transportModeEnum,
} from '../enums.js';
import { createTimestampColumn } from '../utils.js';
import { sql } from 'drizzle-orm';

export const surchargesTable = pgTable(
  'surcharges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dest: varchar('dest', { length: 2 }).notNull(),
    origin: varchar('origin', { length: 2 }), // NULL = all origins
    hs6: varchar('hs6', { length: 6 }), // NULL = all HS6
    surchargeCode: surchargeCodeEnum('surcharge_code').notNull(),
    rateType: surchargeRateTypeEnum('rate_type').notNull().default('ad_valorem'),
    applyLevel: surchargeApplyLevelEnum('apply_level').notNull().default('entry'),
    valueBasis: surchargeValueBasisEnum('value_basis').notNull().default('customs'),
    transportMode: transportModeEnum('transport_mode').notNull().default('ALL'),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    fixedAmt: numeric('fixed_amt', { precision: 12, scale: 2 }), // USD
    pctAmt: numeric('pct_amt', { precision: 10, scale: 6 }), // 0..1 (e.g. 0.003464)
    minAmt: numeric('min_amt', { precision: 12, scale: 2 }),
    maxAmt: numeric('max_amt', { precision: 12, scale: 2 }),
    unitAmt: numeric('unit_amt', { precision: 12, scale: 6 }), // per-unit monetary amount
    unitCode: varchar('unit_code', { length: 16 }), // e.g. 'HOUR','UNIT','KG'
    sourceUrl: text('source_url'),
    sourceRef: text('source_ref'),
    notes: text('notes'),
    effectiveFrom: createTimestampColumn('effective_from', { defaultNow: true }),
    effectiveTo: createTimestampColumn('effective_to', { defaultNow: true, nullable: true }),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => [
    uniqueIndex('surcharges_scope_code_from_uq').on(
      t.dest,
      t.origin,
      t.hs6,
      t.transportMode,
      t.applyLevel,
      t.surchargeCode,
      t.effectiveFrom
    ),
    index('surcharges_lookup_idx').on(
      t.dest,
      t.origin,
      t.hs6,
      t.transportMode,
      t.applyLevel,
      t.surchargeCode,
      t.effectiveFrom,
      t.effectiveTo
    ),
    index('surcharges_dest_code_idx').on(t.dest, t.surchargeCode),
    {
      pct_non_negative_check: sql`CHECK (pct_amt IS NULL OR (pct_amt >= 0 AND pct_amt <= 1))`,
      min_max_order_check: sql`CHECK (min_amt IS NULL OR max_amt IS NULL OR min_amt <= max_amt)`,
    },
  ]
);
