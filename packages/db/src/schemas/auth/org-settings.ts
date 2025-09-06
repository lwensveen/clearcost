import { check, jsonb, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../../utils.js';
import { orgsTable } from './orgs.js';
import { sql } from 'drizzle-orm';

export const orgSettingsTable = pgTable(
  'org_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgsTable.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
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
    uxOrg: uniqueIndex('ux_org_settings_org').on(t.orgId),
    ckCurrencyUpper: check(
      'ck_org_settings_currency_upper',
      sql`upper(${t.defaultCurrency}) = ${t.defaultCurrency}`
    ),
  })
);
