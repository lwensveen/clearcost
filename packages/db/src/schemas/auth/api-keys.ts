import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createTimestampColumn } from '../../utils.js';

export const apiKeysTable = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    ownerId: uuid('owner_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    scopes: text('scopes')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createTimestampColumn('created_at'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: false }),
  },
  (t) => ({
    byOwner: index('idx_api_keys_owner').on(t.ownerId, t.isActive),
    uxHash: uniqueIndex('ux_api_keys_hash').on(t.tokenHash),
  })
);
