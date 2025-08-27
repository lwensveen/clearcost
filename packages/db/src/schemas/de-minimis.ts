import { index, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createTimestampColumn, defaultTimestampOptions } from '../utils.js';
import { deMinimisBasis, deMinimisKind } from '../enums.js';

export const deMinimisTable = pgTable(
  'de_minimis',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    dest: text('dest').notNull(), // ISO-3166-1 alpha-2
    kind: text('kind', { enum: deMinimisKind }).notNull(), // 'DUTY' | 'VAT'
    basis: text('basis', { enum: deMinimisBasis }).notNull().default('INTRINSIC'),
    currency: text('currency').notNull(), // ISO-4217
    value: numeric('value', { precision: 14, scale: 2 }).notNull(), // threshold in `currency`
    effectiveFrom: createTimestampColumn('effective_from', { defaultNow: true }).notNull(),
    effectiveTo: timestamp('effective_to', defaultTimestampOptions),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => [
    uniqueIndex('ux_dem_dest_kind_from').on(t.dest, t.kind, t.effectiveFrom),
    index('idx_dem_dest_kind_window').on(t.dest, t.kind, t.effectiveFrom, t.effectiveTo),
  ]
);
