import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { usersTable } from '../users/users.js';
import { createTimestampColumn } from '../../utils.js';

export const sessionsTable = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: uuid('user_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  impersonatedBy: uuid('impersonated_by').references(() => usersTable.id),
  createdAt: createTimestampColumn('created_at'),
  updatedAt: createTimestampColumn('updated_at', true),
});
