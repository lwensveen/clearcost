import { z } from 'zod/v4';
import { manifestItemQuotesTable } from '@clearcost/db';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';

export const ManifestItemQuoteSelectSchema = createSelectSchema(manifestItemQuotesTable);
export const ManifestItemQuoteInsertSchema = createInsertSchema(manifestItemQuotesTable);
export const ManifestItemQuoteUpdateSchema = createUpdateSchema(manifestItemQuotesTable);

export const ManifestItemQuoteSelectCoercedSchema = ManifestItemQuoteSelectSchema.extend({
  basis: z.coerce.number(),
  chargeableKg: z.coerce.number().nullable().optional(),
  freightShare: z.coerce.number(),
  components: z.object({
    CIF: z.coerce.number(),
    duty: z.coerce.number(),
    vat: z.coerce.number(),
    fees: z.coerce.number(),
    checkoutVAT: z.coerce.number().optional(),
  }),
  total: z.coerce.number(),
  guaranteedMax: z.coerce.number(),
  fxAsOf: z.coerce.date().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const ManifestItemQuoteByIdSchema = z.object({ id: z.string().uuid() });

export const ManifestItemQuotesListQuerySchema = z.object({
  manifestId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  hs6: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  currency: z.string().length(3).optional(),
  limit: z.coerce.number().int().positive().max(5000).optional(),
});
