import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { dutyRateComponentsTable } from '@clearcost/db';

export const DutyRateComponentSelectSchema = createSelectSchema(dutyRateComponentsTable);
export const DutyRateComponentInsertSchema = createInsertSchema(dutyRateComponentsTable);
export const DutyRateComponentUpdateSchema = createUpdateSchema(dutyRateComponentsTable);

export const DutyRateComponentSelectCoercedSchema = DutyRateComponentSelectSchema.extend({
  ratePct: z.coerce.number().nullable().optional(),
  amount: z.coerce.number().nullable().optional(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
});

export const DutyRateComponentByIdSchema = z.object({ id: z.string().uuid() });

export const DutyRateComponentsListQuerySchema = z.object({
  dutyRateId: z.string().uuid().optional(),
  componentType: z.string().min(1).optional(),
  currency: z.string().length(3).optional(),
  uom: z.string().max(32).optional(),
  qualifier: z.string().max(32).optional(),
  activeOn: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});
