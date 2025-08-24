import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { deMinimisTable } from '@clearcost/db';

export const DeMinimisSelectSchema = createSelectSchema(deMinimisTable);
export const DeMinimisInsertSchema = createInsertSchema(deMinimisTable);
export const DeMinimisUpdateSchema = createUpdateSchema(deMinimisTable);

export const DeMinimisSelectCoercedSchema = DeMinimisSelectSchema.extend({
  value: z.coerce.number(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
});

export const DeMinimisByIdSchema = z.object({ id: z.string().uuid() });

export const DeMinimisListQuerySchema = z.object({
  dest: z.string().length(2).optional(),
  appliesTo: z.enum(['DUTY', 'DUTY_VAT', 'NONE']).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});
