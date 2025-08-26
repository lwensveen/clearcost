import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { vatRulesTable } from '@clearcost/db';

export const VatRuleSelectSchema = createSelectSchema(vatRulesTable);
export const VatRuleInsertSchema = createInsertSchema(vatRulesTable);
export const VatRuleUpdateSchema = createUpdateSchema(vatRulesTable);

export const VatRuleSelectCoercedSchema = VatRuleSelectSchema.extend({
  ratePct: z.coerce.number(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
});

export const VatRuleByIdSchema = z.object({ id: z.string().uuid() });

export const VatRulesListQuerySchema = z.object({
  dest: z.string().length(2).optional(),
  kind: z.enum(['STANDARD', 'REDUCED', 'SUPER_REDUCED', 'ZERO']).optional(),
  activeOn: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});
