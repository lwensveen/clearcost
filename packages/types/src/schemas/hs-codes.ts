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

export const HsCodeSearchQuerySchema = z.object({
  q: z.string().min(1).optional(),
  hs6: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  ahtn8: z
    .string()
    .regex(/^\d{8}$/)
    .optional(),
  cn8: z
    .string()
    .regex(/^\d{8}$/)
    .optional(),
  hts10: z
    .string()
    .regex(/^\d{10}$/)
    .optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});
