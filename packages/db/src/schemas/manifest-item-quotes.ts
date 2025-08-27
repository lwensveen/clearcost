import { char, index, jsonb, numeric, pgTable, uuid } from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../utils.js';
import { manifestsTable } from './manifests.js';
import { manifestItemsTable } from './manifest-items.js';
import { incotermEnum } from '../enums.js';

export const manifestItemQuotesTable = pgTable(
  'manifest_item_quotes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    manifestId: uuid('manifest_id')
      .notNull()
      .references(() => manifestsTable.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => manifestItemsTable.id, { onDelete: 'cascade' }),
    // Resolved HS and currency of the quote (usually = dest ISO currency)
    hs6: char('hs6', { length: 6 }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    // Basis for freight allocation (air: chargeable kg; sea: m3)
    basis: numeric('basis', { precision: 16, scale: 6 }).notNull(),
    chargeableKg: numeric('chargeable_kg', { precision: 16, scale: 6 }), // null for sea
    // The per-item share of freight (already in `currency`)
    freightShare: numeric('freight_share', { precision: 16, scale: 6 }).notNull(),
    // Components as JSON (rounded numbers in final currency)
    components: jsonb('components')
      .$type<{
        CIF: number;
        duty: number;
        vat: number;
        fees: number;
        checkoutVAT?: number;
      }>()
      .notNull(),
    total: numeric('total', { precision: 16, scale: 6 }).notNull(),
    guaranteedMax: numeric('guaranteed_max', { precision: 16, scale: 6 }).notNull(),
    incoterm: incotermEnum('incoterm').default('DAP').notNull(),
    // FX day used for conversions (so we can reprice consistently later if needed)
    fxAsOf: createTimestampColumn('fx_as_of', { defaultNow: true }),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    byItem: index('manifest_item_quotes_by_item').on(t.itemId),
    byManifest: index('manifest_item_quotes_by_manifest').on(t.manifestId),
  })
);
