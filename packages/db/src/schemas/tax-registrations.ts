import { boolean, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../utils.js';
import { orgsTable } from './auth/orgs.js';

export const taxRegistrationsTable = pgTable('tax_registrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => orgsTable.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  // ISO-3166-1 alpha-2 for country; special region 'EU' allowed for IOSS/OSS
  jurisdiction: varchar('jurisdiction', { length: 2 }).notNull(), // e.g., 'EU','GB','AU','NZ'
  scheme: varchar('scheme', { length: 8 }).notNull(), // 'IOSS' | 'OSS' | 'VAT' | 'GST'
  registrationNumber: text('registration_number').notNull(),
  validFrom: createTimestampColumn('valid_from', { defaultNow: true }),
  validTo: createTimestampColumn('valid_to', { nullable: true, defaultNow: false }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createTimestampColumn('created_at', { defaultNow: true }),
  updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
});
