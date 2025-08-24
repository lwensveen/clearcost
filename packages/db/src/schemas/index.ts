import { accountsTable } from './auth/accounts.js';
import { apiKeysTable } from './auth/api-keys.js';
import { auditQuotesTable } from './audit-quotes.js';
import { categoriesTable } from './categories.js';
import { deMinimisTable } from './de-minimis.js';
import { dutyRatesTable } from './duty-rates.js';
import { freightRateCardsTable } from './freight-rate-cards.js';
import { freightRateStepsTable } from './freight-rate-steps.js';
import { hsCodesTable } from './hs-codes.js';
import { idempotencyKeysTable } from './idempotency-keys.js';
import { passkeysTable } from './auth/passkeys.js';
import { sessionsTable } from './auth/sessions.js';
import { surchargesTable } from './surcharges.js';
import { usersTable } from './users/users.js';
import { vatRulesTable } from './vat-rules.js';
import { verificationsTable } from './auth/verifications.js';

export * from './audit-quotes.js';
export * from './auth/accounts.js';
export * from './auth/api-keys.js';
export * from './auth/passkeys.js';
export * from './auth/sessions.js';
export * from './auth/verifications.js';
export * from './categories.js';
export * from './de-minimis.js';
export * from './duty-rates.js';
export * from './freight-rate-cards.js';
export * from './freight-rate-steps.js';
export * from './hs-codes.js';
export * from './idempotency-keys.js';
export * from './surcharges.js';
export * from './users/users.js';
export * from './vat-rules.js';

export const schema = {
  accountsTable,
  apiKeysTable,
  auditQuotesTable,
  categoriesTable,
  deMinimisTable,
  dutyRatesTable,
  freightRateCardsTable,
  freightRateStepsTable,
  hsCodesTable,
  idempotencyKeysTable,
  passkeysTable,
  sessionsTable,
  surchargesTable,
  usersTable,
  vatRulesTable,
  verificationsTable,
};

export type Schema = typeof schema;
