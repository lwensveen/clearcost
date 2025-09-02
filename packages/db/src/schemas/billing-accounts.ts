import { pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../utils.js';

export const billingAccountsTable = pgTable(
  'billing_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: text('owner_id').notNull(),
    stripeCustomerId: text('stripe_customer_id'),
    plan: text('plan'),
    status: text('status'),
    priceId: text('price_id'),
    currentPeriodEnd: createTimestampColumn('current_period_end', {
      nullable: true,
      defaultNow: false,
    }),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    ownerUnique: uniqueIndex('billing_accounts_owner_unique').on(t.ownerId),
    customerUnique: uniqueIndex('billing_accounts_customer_unique').on(t.stripeCustomerId),
  })
);
