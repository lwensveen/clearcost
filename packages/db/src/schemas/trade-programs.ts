import { index, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../utils.js';
import { jurisdictionsTable } from './jurisdictions.js';

export const tradeProgramsTable = pgTable(
  'trade_programs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => jurisdictionsTable.id, { onDelete: 'restrict' }),
    code: varchar('code', { length: 16 }).notNull(),
    name: text('name').notNull(),
    kind: varchar('kind', { length: 16 }).notNull().default('fta'),
    notes: text('notes'),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    uqOwnerCode: uniqueIndex('trade_programs_owner_code_uq').on(t.ownerId, t.code),
    idxOwner: index('trade_programs_owner_idx').on(t.ownerId),
  })
);
