import { index, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../utils.js';

export const countriesTable = pgTable(
  'countries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    iso2: varchar('iso2', { length: 2 }).notNull(),
    iso3: varchar('iso3', { length: 3 }),
    name: text('name').notNull(),
    officialName: text('official_name'),
    numeric: varchar('numeric', { length: 3 }), // UN M49 (as string)
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    uqIso2: uniqueIndex('countries_iso2_uq').on(t.iso2),
    uqIso3: uniqueIndex('countries_iso3_uq').on(t.iso3),
    idxName: index('countries_name_idx').on(t.name),
  })
);
