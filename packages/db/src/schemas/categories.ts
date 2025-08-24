import { index, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../utils.js';

export const categoriesTable = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 128 }).notNull().unique(),
    defaultHs6: varchar('default_hs6', { length: 6 }).notNull(),
    title: varchar('title', { length: 256 }).notNull(),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    fkDefaultHs6: index('categories_default_hs6_idx').on(t.defaultHs6),
  })
);
