import { char, index, numeric, pgTable, uuid } from 'drizzle-orm/pg-core';
import { manifestsTable } from './manifests.js';
import { createTimestampColumn } from '../utils.js';

export const manifestQuotesTable = pgTable(
  'manifest_quotes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    manifestId: uuid('manifest_id')
      .notNull()
      .references(() => manifestsTable.id, { onDelete: 'cascade' }),
    currency: char('currency', { length: 3 }).notNull(),
    // Totals across all items at the time of quoting
    itemsCount: numeric('items_count', { precision: 12, scale: 0 }).notNull(),
    freightTotal: numeric('freight_total', { precision: 18, scale: 6 }).notNull(),
    dutyTotal: numeric('duty_total', { precision: 18, scale: 6 }).notNull(),
    vatTotal: numeric('vat_total', { precision: 18, scale: 6 }).notNull(),
    feesTotal: numeric('fees_total', { precision: 18, scale: 6 }).notNull(),
    checkoutVatTotal: numeric('checkout_vat_total', { precision: 18, scale: 6 }),
    grandTotal: numeric('grand_total', { precision: 18, scale: 6 }).notNull(),
    fxAsOf: createTimestampColumn('fx_as_of', { defaultNow: true }),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    byManifest: index('manifest_quotes_by_manifest').on(t.manifestId),
  })
);
