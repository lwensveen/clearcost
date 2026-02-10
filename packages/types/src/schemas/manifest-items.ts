import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { manifestItemsTable } from '@clearcost/db';

export const ManifestItemSelectSchema = createSelectSchema(manifestItemsTable);
export const ManifestItemInsertSchema = createInsertSchema(manifestItemsTable);
export const ManifestItemUpdateSchema = createUpdateSchema(manifestItemsTable);

export const ManifestItemSelectCoercedSchema = ManifestItemSelectSchema.extend({
  itemValueAmount: z.coerce.number(),
  dimsCm: z
    .object({ l: z.coerce.number(), w: z.coerce.number(), h: z.coerce.number() })
    .nullable()
    .optional()
    .transform((v) => v ?? { l: 0, w: 0, h: 0 }),
  weightKg: z.coerce.number(),
  quantity: z.coerce.number().nullable().optional(),
  liters: z.coerce.number().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const ManifestItemByIdSchema = z.object({ id: z.string().uuid() });

export const ManifestItemsListQuerySchema = z.object({
  manifestId: z.string().uuid().optional(),
  hs6: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  categoryKey: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(2000).optional(),
});
