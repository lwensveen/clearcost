import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { orgSettingsTable } from '@clearcost/db';

export const OrgSettingsSelectSchema = createSelectSchema(orgSettingsTable);
export const OrgSettingsInsertSchema = createInsertSchema(orgSettingsTable);
export const OrgSettingsUpdateSchema = createUpdateSchema(orgSettingsTable);

export const OrgSettingsSelectCoercedSchema = OrgSettingsSelectSchema.extend({
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
});

export const OrgHeaderSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
});

export const OrgSettingsByIdSchema = z.object({ id: z.string().uuid() });

export const OrgSettingsListQuerySchema = z.object({
  orgId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

export const OrgSettingsBodySchema = z.object({
  name: z.string().min(1),
  billingEmail: z.string().email().nullable().optional(),
  defaultCurrency: z.string().length(3),
  taxId: z.string().max(64).nullable().optional(),
  webhookUrl: z.string().url().nullable().optional(),
});

export const OrgSettingsResponseSchema = z.object({
  org: OrgHeaderSchema,
  settings: OrgSettingsSelectCoercedSchema,
});

export const OrgSettingsRotateWebhookResponseSchema = z.object({
  ok: z.literal(true),
  secret: z.string(),
});
