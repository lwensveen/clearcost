import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { hsCodeAliasesTable } from '@clearcost/db';

export const HsAliasSelectSchema = createSelectSchema(hsCodeAliasesTable);
export const HsAliasInsertSchema = createInsertSchema(hsCodeAliasesTable);
export const HsAliasUpdateSchema = createUpdateSchema(hsCodeAliasesTable);

export const HsAliasSelectCoercedSchema = HsAliasSelectSchema.extend({
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
});

export const HsAliasByIdSchema = z.object({ id: z.string().uuid() });
