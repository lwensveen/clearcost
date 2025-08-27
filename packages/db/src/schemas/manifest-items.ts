import { char, index, jsonb, numeric, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { manifestsTable } from './manifests.js';
import { createTimestampColumn } from '../utils.js';

export const manifestItemsTable = pgTable(
  'manifest_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    manifestId: uuid('manifest_id')
      .notNull()
      .references(() => manifestsTable.id, { onDelete: 'cascade' }),
    // Commercial value entered by the shipper
    itemValueAmount: numeric('item_value_amount', { precision: 16, scale: 4 }).notNull(),
    itemValueCurrency: char('item_value_currency', { length: 3 }).notNull(),
    // Physicals
    dimsCm: jsonb('dims_cm').$type<{ l: number; w: number; h: number }>().notNull(),
    weightKg: numeric('weight_kg', { precision: 12, scale: 3 }).notNull(),
    // Classification hints
    hs6: char('user_hs6', { length: 6 }), // optional user-provided HS6
    categoryKey: varchar('category_key', { length: 256 }), // fallback classifier key
    // Optional label/notes
    reference: varchar('reference', { length: 256 }),
    notes: varchar('notes', { length: 1024 }),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    byManifest: index('manifest_items_by_manifest').on(t.manifestId),
  })
);
