import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { orgsTable } from '@clearcost/db';

export const OrgSelectSchema = createSelectSchema(orgsTable);
export const OrgInsertSchema = createInsertSchema(orgsTable);
export const OrgUpdateSchema = createUpdateSchema(orgsTable);

export const OrgSelectCoercedSchema = OrgSelectSchema.extend({
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
});

export const OrgByIdSchema = z.object({ id: z.string().uuid() });

export const OrgsListQuerySchema = z.object({
  externalId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});
