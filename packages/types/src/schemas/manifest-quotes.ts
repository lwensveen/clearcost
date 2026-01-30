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

export const ManifestQuoteItemSchema = z.object({
  id: z.string().uuid(),
  currency: z.string().length(3).optional(),
  basis: z.number(),
  chargeableKg: z.number().nullable().optional(),
  freightShare: z.number(),
  components: z.object({
    CIF: z.number(),
    duty: z.number(),
    vat: z.number(),
    fees: z.number(),
    checkoutVAT: z.number().optional(),
  }),
});

export const ManifestQuoteSummarySchema = z.object({
  itemsCount: z.number(),
  currency: z.string().length(3).optional(),
  freight: z.number(),
  duty: z.number(),
  vat: z.number(),
  fees: z.number(),
  checkoutVat: z.number().nullable().optional(),
  grandTotal: z.number(),
  fxAsOf: z.date().optional(),
  updatedAt: z.date(),
});

export const ManifestQuoteResponseSchema = z.object({
  ok: z.literal(true),
  manifestId: z.string().uuid(),
  summary: ManifestQuoteSummarySchema,
  items: z.array(ManifestQuoteItemSchema),
});
