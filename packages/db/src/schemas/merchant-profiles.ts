import { boolean, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../utils.js';

export const merchantProfilesTable = pgTable('merchant_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().unique(),
  defaultIncoterm: varchar('default_incoterm', { length: 3 }).notNull().default('DAP'),
  defaultCurrency: varchar('default_currency', { length: 3 }).notNull().default('USD'),
  chargeShippingAtCheckout: boolean('charge_shipping_at_checkout').notNull().default(false),
  collectVatAtCheckout: text('collect_vat_checkout').notNull().default('auto'),
  createdAt: createTimestampColumn('created_at', { defaultNow: true }),
  updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
});
