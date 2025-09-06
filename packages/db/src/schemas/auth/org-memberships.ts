import { index, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { usersTable } from '../users/users.js';
import { orgsTable } from './orgs.js';
import { createTimestampColumn } from '../../utils.js';
import { orgRoleEnum } from '../../enums.js';

export const orgMembershipsTable = pgTable(
  'org_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgsTable.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    role: orgRoleEnum('role').notNull().default('member'),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    uxOrgUser: uniqueIndex('ux_org_memberships_org_user').on(t.orgId, t.userId),
    ixUser: index('ix_org_memberships_user').on(t.userId),
    ixOrg: index('ix_org_memberships_org').on(t.orgId),
  })
);
