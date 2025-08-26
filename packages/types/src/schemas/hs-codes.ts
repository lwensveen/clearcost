import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { hsCodesTable } from '@clearcost/db';

export const HsCodeSelectSchema = createSelectSchema(hsCodesTable);
export const HsCodeInsertSchema = createInsertSchema(hsCodesTable);
export const HsCodeUpdateSchema = createUpdateSchema(hsCodesTable);

export const HsCodeSelectCoercedSchema = HsCodeSelectSchema.extend({
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
});

export const HsCodeByIdSchema = z.object({ id: z.string().uuid() });

/**
 * Search HS6 (by text / hs6) and/or by alias (system+code).
 * - q: fuzzy text search (title)
 * - hs6: canonical HS6
 * - system+code: alias lookup (CN8/HTS10/UK10/AHTN8)
 */
export const HsCodeSearchQuerySchema = z.object({
  q: z.string().min(1).optional(),
  hs6: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  system: z.enum(['CN8', 'HTS10', 'UK10', 'AHTN8']).optional(),
  code: z
    .string()
    .regex(/^\d{8,10}$/)
    .optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});
