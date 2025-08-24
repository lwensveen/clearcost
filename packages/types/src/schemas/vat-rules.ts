import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { vatRulesTable } from '@clearcost/db';

export const VatRuleSelectSchema = createSelectSchema(vatRulesTable);
export const VatRuleInsertSchema = createInsertSchema(vatRulesTable);
export const VatRuleUpdateSchema = createUpdateSchema(vatRulesTable);

export const VatRuleSelectCoercedSchema = VatRuleSelectSchema.extend({
  ratePct: z.coerce.number(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
});

export const VatRuleByIdSchema = z.object({ id: z.string().uuid() });

export const VatRulesListQuerySchema = z.object({
  dest: z.string().length(2).optional(),
  base: z.enum(['CIF', 'CIF_PLUS_DUTY']).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});
