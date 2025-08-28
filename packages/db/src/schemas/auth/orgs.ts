import { pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../../utils.js';

export const orgsTable = pgTable(
  'orgs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    externalId: text('external_id'),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    uxExternal: uniqueIndex('ux_orgs_external').on(t.externalId),
  })
);
