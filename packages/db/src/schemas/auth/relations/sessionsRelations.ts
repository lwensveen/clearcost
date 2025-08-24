import { relations } from 'drizzle-orm';
import { sessionsTable } from '../sessions.js';
import { usersTable } from '../../users/users.js';

export const sessionsRelations = relations(sessionsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [sessionsTable.userId],
    references: [usersTable.id],
  }),
}));
