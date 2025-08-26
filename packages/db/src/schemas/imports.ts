import { bigint, integer, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { importSourceEnum, importStatusEnum } from '../enums.js';
import { createTimestampColumn } from '../utils.js';

export const importsTable = pgTable('imports', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: importSourceEnum('source').notNull(), // e.g. 'WITS'
  job: varchar('job', { length: 64 }).notNull(), // e.g. 'duties/eu-mfn'
  version: varchar('version', { length: 32 }), // importer version/hash (optional)
  sourceUrl: text('source_url'), // main file/API
  params: text('params'), // JSON stringified small config
  fileHash: varchar('file_hash', { length: 64 }), // sha256 of main artifact (hex)
  fileBytes: bigint('file_bytes', { mode: 'number' }), // size in bytes
  status: importStatusEnum('status').notNull().default('running'),
  inserted: integer('inserted').default(0),
  updated: integer('updated').default(0),
  error: text('error'), // short excerpt if failed
  startedAt: createTimestampColumn('started_at', { defaultNow: true }),
  finishedAt: createTimestampColumn('finished_at', {}),
  createdAt: createTimestampColumn('created_at', { defaultNow: true }),
  updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
});
