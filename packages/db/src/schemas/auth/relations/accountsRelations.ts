import { relations } from 'drizzle-orm';
import { accountsTable } from '../accounts.js';
import { usersTable } from '../../users/users.js';

export const accountsRelations = relations(accountsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [accountsTable.userId],
    references: [usersTable.id],
  }),
}));
