import { boolean, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../../utils.js';
import { usersTable } from '../users/users.js';

export const passkeysTable = pgTable('passkey', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  publicKey: text('public_key').notNull(),
  userId: uuid('user_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  credentialId: text('credential_id').notNull().unique(),
  counter: integer('counter').notNull().default(0),
  deviceType: text('device_type').notNull(),
  backedUp: boolean('backed_up').notNull().default(false),
  transports: text('transports').notNull(),
  createdAt: createTimestampColumn('created_at'),
  updatedAt: createTimestampColumn('updated_at', true),
});
