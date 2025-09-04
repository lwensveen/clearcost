import { accountsTable } from './auth/accounts.js';
import { apiKeysTable } from './auth/api-keys.js';
import { apiUsageTable } from './api-usage.js';
import { auditQuotesTable } from './audit-quotes.js';
import { billingAccountsTable } from './billing-accounts.js';
import { categoriesTable } from './categories.js';
import { countriesTable } from './countries.js';
import { deMinimisTable } from './de-minimis.js';
import { dutyRateComponentsTable } from './duty-rate-components.js';
import { dutyRatesTable } from './duty-rates.js';
import { freightRateCardsTable } from './freight-rate-cards.js';
import { freightRateStepsTable } from './freight-rate-steps.js';
import { fxRatesTable } from './fx-rates.js';
import { hsCodeAliasesTable } from './hs-code-aliases.js';
import { hsCodesTable } from './hs-codes.js';
import { idempotencyKeysTable } from './idempotency-keys.js';
import { importsTable } from './imports.js';
import { jurisdictionsTable } from './jurisdictions.js';
import { manifestItemQuotesTable } from './manifest-item-quotes.js';
import { manifestItemsTable } from './manifest-items.js';
import { manifestQuotesTable } from './manifest-quotes.js';
import { manifestSnapshotsTable } from './manifest-snapshots.js';
import { manifestsTable } from './manifests.js';
import { merchantProfilesTable } from './merchant-profiles.js';
import { orgMembershipsTable } from './auth/org-memberships.js';
import { orgSettingsTable } from './auth/org-settings.js';
import { orgsTable } from './auth/orgs.js';
import { passkeysTable } from './auth/passkeys.js';
import { provenanceTable } from './provenance.js';
import { quoteSnapshotsTable } from './quote-snapshots.js';
import { sessionsTable } from './auth/sessions.js';
import { surchargesTable } from './surcharges.js';
import { taxRegistrationsTable } from './tax-registrations.js';
import { tradeProgramMembersTable } from './trade-program-members.js';
import { tradeProgramsTable } from './trade-programs.js';
import { usersTable } from './users/users.js';
import { vatOverridesTable } from './vat-overrides.js';
import { vatRulesTable } from './vat-rules.js';
import { verificationsTable } from './auth/verifications.js';
import { webhookDeliveriesTable, webhookEndpointsTable } from './webhooks.js';

export * from '../enums.js';
export * from './api-usage.js';
export * from './audit-quotes.js';
export * from './auth/accounts.js';
export * from './auth/api-keys.js';
export * from './auth/org-memberships.js';
export * from './auth/org-settings.js';
export * from './auth/orgs.js';
export * from './auth/passkeys.js';
export * from './auth/sessions.js';
export * from './auth/verifications.js';
export * from './billing-accounts.js';
export * from './categories.js';
export * from './countries.js';
export * from './de-minimis.js';
export * from './duty-rate-components.js';
export * from './duty-rates.js';
export * from './freight-rate-cards.js';
export * from './freight-rate-steps.js';
export * from './fx-rates.js';
export * from './hs-code-aliases.js';
export * from './hs-codes.js';
export * from './idempotency-keys.js';
export * from './imports.js';
export * from './jurisdictions.js';
export * from './manifest-item-quotes.js';
export * from './manifest-items.js';
export * from './manifest-quotes.js';
export * from './manifest-snapshots.js';
export * from './manifests.js';
export * from './merchant-profiles.js';
export * from './provenance.js';
export * from './quote-snapshots.js';
export * from './surcharges.js';
export * from './tax-registrations.js';
export * from './trade-program-members.js';
export * from './trade-programs.js';
export * from './users/users.js';
export * from './vat-overrides.js';
export * from './vat-rules.js';
export * from './webhooks.js';

export const schema = {
  accountsTable,
  apiKeysTable,
  apiUsageTable,
  auditQuotesTable,
  billingAccountsTable,
  categoriesTable,
  countriesTable,
  deMinimisTable,
  dutyRateComponentsTable,
  dutyRatesTable,
  freightRateCardsTable,
  freightRateStepsTable,
  fxRatesTable,
  hsCodeAliasesTable,
  hsCodesTable,
  idempotencyKeysTable,
  importsTable,
  jurisdictionsTable,
  manifestItemQuotesTable,
  manifestItemsTable,
  manifestQuotesTable,
  manifestSnapshotsTable,
  manifestsTable,
  merchantProfilesTable,
  orgMembershipsTable,
  orgSettingsTable,
  orgsTable,
  passkeysTable,
  provenanceTable,
  quoteSnapshotsTable,
  sessionsTable,
  surchargesTable,
  taxRegistrationsTable,
  tradeProgramMembersTable,
  tradeProgramsTable,
  usersTable,
  vatOverridesTable,
  vatRulesTable,
  verificationsTable,
  webhookDeliveriesTable,
  webhookEndpointsTable,
};

export type Schema = typeof schema;
