import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../../utils.js';

export const verificationsTable = pgTable('verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: createTimestampColumn('created_at'),
  updatedAt: createTimestampColumn('updated_at', true),
});
