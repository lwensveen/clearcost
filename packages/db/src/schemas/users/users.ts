import { bigint, boolean, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../../utils.js';

export const usersTable = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').notNull(),
    image: text('image'),
    username: text('username').unique(),
    displayUsername: text('display_username'),
    role: text('role').notNull().default('user'),
    banned: boolean('banned').notNull().default(false),
    banReason: text('ban_reason'),
    banExpires: bigint('ban_expires', { mode: 'number' }),
    createdAt: createTimestampColumn('created_at'),
    updatedAt: createTimestampColumn('updated_at', true),
  },
  (table) => [index('user_email_idx').on(table.email)]
);
