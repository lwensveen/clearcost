// packages/db/src/schemas/api-keys.ts
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
    // Public, non-secret identifier embedded in the token (before the dot)
    keyId: text('key_id').notNull(),
    // live/test (or others if you need)
    prefix: text('prefix').notNull().default('live'),
    name: text('name').notNull(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => orgsTable.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    // Per-key random salt (base64url)
    salt: text('salt').notNull(),
    // Hex digest of sha256(salt || '|' || secret || '|' || pepper)
    tokenHash: text('token_hash').notNull(),
    scopes: text('scopes')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    isActive: boolean('is_active').notNull().default(true),
    expiresAt: timestamp('expires_at'),
    revokedAt: timestamp('revoked_at'),
    // ABAC/network controls
    allowedCidrs: text('allowed_cidrs')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    allowedOrigins: text('allowed_origins')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    // Per-key throttles (fall back to global)
    rateLimitPerMin: integer('rate_limit_per_min'),
    createdAt: createTimestampColumn('created_at'),
    updatedAt: createTimestampColumn('updated_at', { onUpdate: true }),
    lastUsedAt: createTimestampColumn('last_used_at'),
    meta: jsonb('meta'),
  },
  (t) => ({
    uxKeyId: uniqueIndex('ux_api_keys_keyid').on(t.keyId),
    uxHash: uniqueIndex('ux_api_keys_hash').on(t.tokenHash),
    byOwnerActive: index('idx_api_keys_owner_active').on(t.ownerId, t.isActive),
  })
);
