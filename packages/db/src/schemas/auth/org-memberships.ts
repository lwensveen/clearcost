import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { usersTable } from '../users/users.js';
import { orgsTable } from './orgs.js';
import { createTimestampColumn } from '../../utils.js';

export const orgMembershipsTable = pgTable('org_memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgsTable.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  role: text('role').notNull().default('member'), // owner|admin|member
  createdAt: createTimestampColumn('created_at', { defaultNow: true }),
  updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
});
