import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { manifestsTable } from '@clearcost/db';

export const ManifestSelectSchema = createSelectSchema(manifestsTable);
export const ManifestInsertSchema = createInsertSchema(manifestsTable);
export const ManifestUpdateSchema = createUpdateSchema(manifestsTable);

export const ManifestSelectCoercedSchema = ManifestSelectSchema.extend({
  fixedFreightTotal: z.coerce.number().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const ManifestByIdSchema = z.object({ id: z.string().uuid() });

export const ManifestsListQuerySchema = z.object({
  origin: z.string().length(2).optional(),
  dest: z.string().length(2).optional(),
  mode: z.enum(['air', 'sea']).optional(),
  pricingMode: z.enum(['cards', 'fixed']).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});
