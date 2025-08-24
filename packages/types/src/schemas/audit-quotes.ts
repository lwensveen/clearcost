import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { auditQuotesTable } from '@clearcost/db';

export const AuditQuoteSelectSchema = createSelectSchema(auditQuotesTable);
export const AuditQuoteInsertSchema = createInsertSchema(auditQuotesTable);
export const AuditQuoteUpdateSchema = createUpdateSchema(auditQuotesTable);

export const AuditQuoteSelectCoercedSchema = AuditQuoteSelectSchema.extend({
  itemValue: z.coerce.number(),
  weightKg: z.coerce.number(),
  chargeableKg: z.coerce.number().nullable().optional(),
  freight: z.coerce.number().nullable().optional(),
  dutyQuoted: z.coerce.number().nullable().optional(),
  vatQuoted: z.coerce.number().nullable().optional(),
  feesQuoted: z.coerce.number().nullable().optional(),
  totalQuoted: z.coerce.number().nullable().optional(),
  dutyActual: z.coerce.number().nullable().optional(),
  vatActual: z.coerce.number().nullable().optional(),
  feesActual: z.coerce.number().nullable().optional(),
  totalActual: z.coerce.number().nullable().optional(),
  lowConfidence: z.coerce.boolean(),
  createdAt: z.coerce.date(),
});

export const AuditQuoteByIdSchema = z.object({ id: z.string().uuid() });

export const AuditQuotesListQuerySchema = z.object({
  laneOrigin: z.string().length(2).optional(),
  laneDest: z.string().length(2).optional(),
  hs6: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});
