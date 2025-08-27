import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { manifestQuotesTable } from '@clearcost/db';

export const ManifestQuoteSelectSchema = createSelectSchema(manifestQuotesTable);
export const ManifestQuoteInsertSchema = createInsertSchema(manifestQuotesTable);
export const ManifestQuoteUpdateSchema = createUpdateSchema(manifestQuotesTable);

export const ManifestQuoteSelectCoercedSchema = ManifestQuoteSelectSchema.extend({
  itemsCount: z.coerce.number(),
  freightTotal: z.coerce.number(),
  dutyTotal: z.coerce.number(),
  vatTotal: z.coerce.number(),
  feesTotal: z.coerce.number(),
  checkoutVatTotal: z.coerce.number().nullable().optional(),
  grandTotal: z.coerce.number(),
  fxAsOf: z.coerce.date().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const ManifestQuoteByIdSchema = z.object({ id: z.string().uuid() });

export const ManifestQuotesListQuerySchema = z.object({
  manifestId: z.string().uuid().optional(),
  currency: z.string().length(3).optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});
