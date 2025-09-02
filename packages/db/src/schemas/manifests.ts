import { char, index, numeric, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { pricingModeEnum, shippingModeEnum } from '../enums.js';
import { createTimestampColumn } from '../utils.js';
import { orgsTable } from './auth/orgs.js';

export const manifestsTable = pgTable(
  'manifests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => orgsTable.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    origin: char('origin', { length: 2 }).notNull(), // ISO-3166-1 alpha-2
    dest: char('dest', { length: 2 }).notNull(), // ISO-3166-1 alpha-2
    shippingMode: shippingModeEnum('shipping_mode').notNull(), // 'air' | 'sea'
    pricingMode: pricingModeEnum('pricing_mode').notNull(), // 'cards' | 'fixed'
    name: varchar('name', { length: 200 }).notNull(),
    // When pricingMode === 'fixed' — total freight for the whole pool
    fixedFreightTotal: numeric('fixed_freight_total', { precision: 16, scale: 4 }),
    fixedFreightCurrency: char('fixed_freight_currency', { length: 3 }),
    // Optional operator notes / external reference
    reference: varchar('reference', { length: 256 }),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    byLane: index('manifests_by_lane').on(t.origin, t.dest, t.shippingMode),
    ownerIdx: index('manifests_owner_created_idx').on(t.ownerId, t.createdAt),
  })
);
