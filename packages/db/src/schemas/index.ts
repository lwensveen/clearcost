import { accountsTable } from './auth/accounts.js';
import { apiKeysTable } from './auth/api-keys.js';
import { passkeysTable } from './auth/passkeys.js';
import { sessionsTable } from './auth/sessions.js';
import { usersTable } from './users/users.js';
import { verificationsTable } from './auth/verifications.js';

export * from './auth/accounts.js';
export * from './auth/api-keys.js';
export * from './auth/passkeys.js';
export * from './auth/sessions.js';
export * from './auth/verifications.js';
export * from './users/users.js';

export const schema = {
  accountsTable,
  apiKeysTable,
  passkeysTable,
  sessionsTable,
  usersTable,
  verificationsTable,
};
