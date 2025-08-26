import { accountsTable } from './auth/accounts.js';
import { apiKeysTable } from './auth/api-keys.js';
import { apiUsageTable } from './api-usage.js';
import { auditQuotesTable } from './audit-quotes.js';
import { categoriesTable } from './categories.js';
import { deMinimisTable } from './de-minimis.js';
import { dutyRatesTable } from './duty-rates.js';
import { freightRateCardsTable } from './freight-rate-cards.js';
import { freightRateStepsTable } from './freight-rate-steps.js';
import { fxRatesTable } from './fx-rates.js';
import { hsCodeAliasesTable } from './hs-code-aliases.js';
import { hsCodesTable } from './hs-codes.js';
import { idempotencyKeysTable } from './idempotency-keys.js';
import { importsTable } from './imports.js';
import { merchantProfilesTable } from './merchant-profiles.js';
import { passkeysTable } from './auth/passkeys.js';
import { provenanceTable } from './provenance.js';
import { sessionsTable } from './auth/sessions.js';
import { surchargesTable } from './surcharges.js';
import { taxRegistrationsTable } from './tax-registrations.js';
import { usersTable } from './users/users.js';
import { vatOverridesTable } from './vat-overrides.js';
import { vatRulesTable } from './vat-rules.js';
import { verificationsTable } from './auth/verifications.js';
import { webhookDeliveriesTable, webhookEndpointsTable } from './webhooks.js';

export * from './api-usage.js';
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
export * from './fx-rates.js';
export * from './hs-code-aliases.js';
export * from './hs-codes.js';
export * from './idempotency-keys.js';
export * from './imports.js';
export * from './merchant-profiles.js';
export * from './provenance.js';
export * from './surcharges.js';
export * from './tax-registrations.js';
export * from './users/users.js';
export * from './vat-overrides.js';
export * from './vat-rules.js';
export * from './webhooks.js';

export const schema = {
  accountsTable,
  apiKeysTable,
  apiUsageTable,
  auditQuotesTable,
  categoriesTable,
  deMinimisTable,
  dutyRatesTable,
  freightRateCardsTable,
  freightRateStepsTable,
  fxRatesTable,
  hsCodeAliasesTable,
  hsCodesTable,
  idempotencyKeysTable,
  importsTable,
  merchantProfilesTable,
  passkeysTable,
  provenanceTable,
  sessionsTable,
  surchargesTable,
  taxRegistrationsTable,
  usersTable,
  vatOverridesTable,
  vatRulesTable,
  verificationsTable,
  webhookDeliveriesTable,
  webhookEndpointsTable,
};

export type Schema = typeof schema;
