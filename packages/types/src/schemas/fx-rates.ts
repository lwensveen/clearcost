import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { fxRatesTable } from '@clearcost/db';

export const FxProviderSchema = z.enum(['ecb', 'exchangerate_host', 'openexchangerates']);

export const FxRateSelectSchema = createSelectSchema(fxRatesTable);
export const FxRateInsertSchema = createInsertSchema(fxRatesTable);
export const FxRateUpdateSchema = createUpdateSchema(fxRatesTable);

export const FxRateSelectCoercedSchema = FxRateSelectSchema.extend({
  rate: z.coerce.number(), // NUMERIC -> number
  asOf: z.coerce.date(),
  ingestedAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  sourceRef: z.string().nullable().optional(),
  provider: FxProviderSchema,
});

export const FxRateByIdSchema = z.object({ id: z.string().uuid() });

export const FxRatesListQuerySchema = z.object({
  base: z.string().length(3).optional(),
  quote: z.string().length(3).optional(),
  provider: FxProviderSchema.optional(),
  asOf: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

export const FxRefreshResponseSchema = z.object({
  base: z.string(),
  fxAsOf: z.string(),
  attemptedInserts: z.number().int().nonnegative(),
});
