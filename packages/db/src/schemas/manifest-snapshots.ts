import { boolean, index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../utils.js';
import { manifestsTable } from './manifests.js';

export const manifestSnapshotsTable = pgTable(
  'manifest_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scope: text('scope').notNull(),
    idemKey: text('idem_key').notNull(),
    manifestId: uuid('manifest_id')
      .notNull()
      .references(() => manifestsTable.id, { onDelete: 'cascade' }),
    request: jsonb('request').$type<Record<string, unknown>>().notNull(),
    response: jsonb('response').$type<Record<string, unknown>>().notNull(),
    allocation: text('allocation').notNull().default('chargeable'),
    dryRun: boolean('dry_run').notNull().default(false),
    dataRuns: jsonb('data_runs').$type<Record<string, unknown> | null>(),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
  },
  (t) => ({
    uxScopeKey: uniqueIndex('ux_manifest_snapshots_scope_key').on(t.scope, t.idemKey),
    byManifest: index('idx_manifest_snapshots_manifest').on(t.manifestId),
    byCreated: index('idx_manifest_snapshots_created').on(t.createdAt),
  })
);
