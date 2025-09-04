import { index, jsonb, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { apiKeysTable } from './auth/api-keys.js';
import { createTimestampColumn } from '../utils.js';

export const quoteSnapshotsTable = pgTable(
  'quote_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scope: varchar('scope', { length: 128 }).notNull(),
    idemKey: varchar('idem_key', { length: 128 }).notNull(),
    request: jsonb('request').notNull(),
    response: jsonb('response').notNull(),
    fxAsOf: createTimestampColumn('fx_as_of', { defaultNow: true }),
    dataRuns: jsonb('data_runs'),
    ownerId: uuid('owner_id').notNull(),
    apiKeyId: uuid('api_key_id')
      .notNull()
      .references(() => apiKeysTable.id),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    idxScopeKey: index('quote_snapshots_scope_key_idx').on(t.scope, t.idemKey),
    idxOwnerCreated: index('quote_snapshots_owner_created_idx').on(t.ownerId, t.createdAt),
  })
);
