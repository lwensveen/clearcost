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

// Public search endpoint: /v1/hs-codes
export const HsCodesSearchQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  hs6: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const HsCodesSearchResponseSchema = z.array(
  z.object({
    hs6: z.string(),
    title: z.string(),
    ahtn8: z.string().nullish(),
    cn8: z.string().nullish(),
    hts10: z.string().nullish(),
  })
);

// Alias lookup endpoint: /v1/hs-codes/lookup
export const HsCodesLookupQuerySchema = z.object({
  system: z.enum(['CN8', 'HTS10', 'UK10', 'AHTN8']),
  code: z.string().regex(/^\d{8,10}$/),
});

export const HsCodesLookupResponseSchema = z.object({
  hs6: z.string(),
  title: z.string(),
  aliasTitle: z.string().nullable().optional(),
  system: z.enum(['CN8', 'HTS10', 'UK10', 'AHTN8']),
  code: z.string(),
});
