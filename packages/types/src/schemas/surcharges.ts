import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { surchargesTable } from '@clearcost/db';

export const SurchargeSelectSchema = createSelectSchema(surchargesTable);
export const SurchargeInsertSchema = createInsertSchema(surchargesTable);
export const SurchargeUpdateSchema = createUpdateSchema(surchargesTable);

export const SurchargeSelectCoercedSchema = SurchargeSelectSchema.extend({
  fixedAmt: z.coerce.number().nullable().optional(),
  pctAmt: z.coerce.number().nullable().optional(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
});

export const SurchargeByIdSchema = z.object({ id: z.string().uuid() });

export const SurchargesListQuerySchema = z.object({
  dest: z.string().length(2).optional(),
  code: z
    .enum([
      'CUSTOMS_PROCESSING',
      'DISBURSEMENT',
      'EXCISE',
      'HANDLING',
      'HMF',
      'MPF',
      'TRADE_REMEDY_232',
      'TRADE_REMEDY_301',
    ])
    .optional(),
  activeOn: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});
