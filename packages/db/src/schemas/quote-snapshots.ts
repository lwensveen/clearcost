import { index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../utils.js';

export const quoteSnapshotsTable = pgTable(
  'quote_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** logical scope, keep 'quotes' for now to allow future snapshot kinds */
    scope: text('scope').notNull().default('quotes'),
    /** idempotency key used for this quote */
    idemKey: text('idem_key').notNull(),
    /** raw request body used to compute the quote */
    request: jsonb('request').notNull(),
    /** full response we returned to the caller */
    response: jsonb('response').notNull(),
    /** FX as-of date used in compute (optional/null if unknown) */
    fxAsOf: createTimestampColumn('fx_as_of', { defaultNow: true }),
    /** optional “data runs” you want to pin (import runs, etc.) */
    dataRuns: jsonb('data_runs'),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    byScopeKey: uniqueIndex('quote_snapshots_scope_key_uq').on(t.scope, t.idemKey),
    createdAtIdx: index('quote_snapshots_created_at_idx').on(t.createdAt),
  })
);
