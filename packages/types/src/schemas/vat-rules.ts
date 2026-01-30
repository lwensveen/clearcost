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

export const VatBaseSchema = z.enum(['CIF', 'CIF_PLUS_DUTY']);

export const VatAdminCreateSchema = z.object({
  dest: z.string().length(2),
  ratePct: z.number().min(0).max(100),
  vatBase: VatBaseSchema.default('CIF_PLUS_DUTY'),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const VatAdminUpdateSchema = VatAdminCreateSchema.partial();

export const VatAdminListQuerySchema = z.object({
  q: z.string().optional(),
  dest: z.string().length(2).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const VatAdminListResponseSchema = z.array(VatRuleSelectCoercedSchema);

export const VatAdminIdParamSchema = z.object({ id: z.string().uuid() });

export const VatAdminImportJsonBodySchema = z.object({
  rows: z.array(VatAdminCreateSchema),
});

export const VatAdminImportJsonResponseSchema = z.object({
  inserted: z.number(),
});

export const VatAdminImportResponseSchema = z.object({
  ok: z.literal(true),
  count: z.number(),
});
