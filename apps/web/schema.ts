import 'server-only';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  accountsTable,
  passkeysTable,
  sessionsTable,
  usersTable,
  verificationsTable,
} from '@clearcost/db';
import { requireEnvStrict } from './lib/env';

let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (dbInstance) return dbInstance;
  dbInstance = drizzle({
    connection: requireEnvStrict('DATABASE_URL'),
    schema: {
      usersTable,
      accountsTable,
      sessionsTable,
      verificationsTable,
      passkeysTable,
    },
    // ws: ws,
  });
  return dbInstance;
}
