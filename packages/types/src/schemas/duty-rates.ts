import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { dutyRatesTable } from '@clearcost/db';

export const DutyRateSelectSchema = createSelectSchema(dutyRatesTable);
export const DutyRateInsertSchema = createInsertSchema(dutyRatesTable);
export const DutyRateUpdateSchema = createUpdateSchema(dutyRatesTable);

export const DutyRateSelectCoercedSchema = DutyRateSelectSchema.extend({
  ratePct: z.coerce.number(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
});

export const DutyRateByIdSchema = z.object({ id: z.string().uuid() });

export const DutyRatesListQuerySchema = z.object({
  dest: z.string().length(2).optional(),
  hs6: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  rule: z.enum(['mfn', 'fta', 'other']).optional(),
  activeOn: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});
