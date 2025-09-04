import { index, jsonb, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../../utils.js';

export const orgSettingsTable = pgTable(
  'org_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id'),
    billingEmail: varchar('billing_email', { length: 320 }),
    defaultCurrency: varchar('default_currency', { length: 3 }).default('USD').notNull(),
    taxId: varchar('tax_id', { length: 64 }),
    address: jsonb('address').$type<{
      line1?: string;
      line2?: string;
      city?: string;
      region?: string;
      postal?: string;
      country?: string;
    }>(),
    webhookUrl: text('webhook_url'),
    webhookSecret: varchar('webhook_secret', { length: 64 }),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    idxOrg: index('org_settings_org_idx').on(t.orgId),
  })
);
