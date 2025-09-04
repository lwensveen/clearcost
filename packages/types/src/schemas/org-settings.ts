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

export const OrgSettingsByIdSchema = z.object({ id: z.string().uuid() });

export const OrgSettingsListQuerySchema = z.object({
  orgId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});
