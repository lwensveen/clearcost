import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createTimestampColumn } from '../../utils.js';
import { orgsTable } from './orgs.js';

export const apiKeysTable = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    keyId: text('key_id').notNull(),
    prefix: text('prefix').notNull().default('live'),
    name: text('name').notNull(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => orgsTable.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    tokenPhc: text('token_phc').notNull(),
    scopes: text('scopes')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    isActive: boolean('is_active').notNull().default(true),
    expiresAt: timestamp('expires_at'),
    revokedAt: timestamp('revoked_at'),
    allowedCidrs: text('allowed_cidrs')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    allowedOrigins: text('allowed_origins')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    rateLimitPerMin: integer('rate_limit_per_min'),
    createdAt: createTimestampColumn('created_at'),
    updatedAt: createTimestampColumn('updated_at', { onUpdate: true }),
    lastUsedAt: createTimestampColumn('last_used_at'),
    meta: jsonb('meta'),
  },
  (t) => ({
    uxKeyId: uniqueIndex('ux_api_keys_keyid').on(t.keyId),
    uxPhc: uniqueIndex('ux_api_keys_phc').on(t.tokenPhc),
    byOwnerActive: index('idx_api_keys_owner_active').on(t.ownerId, t.isActive),
  })
);
