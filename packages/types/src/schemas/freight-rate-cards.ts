import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { freightRateCardsTable } from '@clearcost/db';

export const FreightRateCardSelectSchema = createSelectSchema(freightRateCardsTable);
export const FreightRateCardInsertSchema = createInsertSchema(freightRateCardsTable);
export const FreightRateCardUpdateSchema = createUpdateSchema(freightRateCardsTable);

export const FreightRateCardSelectCoercedSchema = FreightRateCardSelectSchema.extend({
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
});

export const FreightRateCardByIdSchema = z.object({ id: z.string().uuid() });

export const FreightRateCardsListQuerySchema = z.object({
  origin: z.string().length(2).optional(),
  dest: z.string().length(2).optional(),
  mode: z.enum(['air', 'sea']).optional(),
  unit: z.enum(['kg', 'm3']).optional(),
  activeOn: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});
