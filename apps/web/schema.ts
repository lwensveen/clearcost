import { drizzle } from 'drizzle-orm/node-postgres';
import {
  accountsTable,
  passkeysTable,
  sessionsTable,
  usersTable,
  verificationsTable,
} from '@clearcost/db';

export const db = drizzle({
  connection: process.env.DATABASE_URL!,
  schema: {
    usersTable,
    accountsTable,
    sessionsTable,
    verificationsTable,
    passkeysTable,
  },
  // ws: ws,
});
