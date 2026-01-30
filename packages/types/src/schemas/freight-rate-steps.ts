import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { freightRateStepsTable } from '@clearcost/db';

export const FreightRateStepSelectSchema = createSelectSchema(freightRateStepsTable);
export const FreightRateStepInsertSchema = createInsertSchema(freightRateStepsTable);
export const FreightRateStepUpdateSchema = createUpdateSchema(freightRateStepsTable);

export const FreightRateStepSelectCoercedSchema = FreightRateStepSelectSchema.extend({
  uptoQty: z.coerce.number(),
  pricePerUnit: z.coerce.number(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
});

export const FreightRateStepByIdSchema = z.object({ id: z.string().uuid() });

export const FreightRateStepsListQuerySchema = z.object({
  cardId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

export const FreightStepAdminCreateSchema = z.object({
  uptoQty: z.number().positive(),
  pricePerUnit: z.number().nonnegative(),
});

export const FreightStepAdminUpdateSchema = FreightStepAdminCreateSchema.partial().refine(
  (b) => Object.values(b).some((v) => v !== undefined),
  { message: 'At least one field required' }
);

export const FreightStepIdParamSchema = z.object({
  id: z.string().uuid(),
  stepId: z.string().uuid(),
});

export const FreightRateStepsListResponseSchema = z.array(FreightRateStepSelectCoercedSchema);
