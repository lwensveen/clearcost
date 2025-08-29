import { index, pgEnum, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../utils.js';
import { countriesTable } from './countries.js';

export const jurisdictionKindEnum = pgEnum('jurisdiction_kind', [
  'country', // single ISO2 country
  'bloc', // EU, EAEU, SACU, GCC, MERCOSUR, ASEAN, etc.
  'territory', // customs territory that isn’t an ISO2 country
  'other',
]);

export const jurisdictionsTable = pgTable(
  'jurisdictions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // short stable code for the “owner namespace”, e.g. 'US', 'EU', 'GB', 'EAEU'
    code: varchar('code', { length: 8 }).notNull(), // UNIQUE (not PK)
    name: text('name').notNull(),
    kind: jurisdictionKindEnum('kind').notNull().default('country'),
    // optional link to a concrete country (when kind='country')
    countryId: uuid('country_id').references(() => countriesTable.id, { onDelete: 'set null' }),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    uqCode: uniqueIndex('jurisdictions_code_uq').on(t.code),
    idxKind: index('jurisdictions_kind_idx').on(t.kind),
    idxCountry: index('jurisdictions_country_idx').on(t.countryId),
  })
);
