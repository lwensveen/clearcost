import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { manifestsTable } from '@clearcost/db';
import { ManifestItemInsertSchema, ManifestItemSelectCoercedSchema } from './manifest-items.js';

export const ManifestSelectSchema = createSelectSchema(manifestsTable);
export const ManifestInsertSchema = createInsertSchema(manifestsTable);
export const ManifestUpdateSchema = createUpdateSchema(manifestsTable);

export const ManifestSelectCoercedSchema = ManifestSelectSchema.extend({
  fixedFreightTotal: z.coerce.number().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const ManifestByIdSchema = z.object({ id: z.string().uuid() });

export const ManifestsListQuerySchema = z.object({
  origin: z.string().length(2).optional(),
  dest: z.string().length(2).optional(),
  shippingMode: z.enum(['air', 'sea']).optional(),
  pricingMode: z.enum(['cards', 'fixed']).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

export const ManifestsListResponseSchema = z.object({
  items: z.array(ManifestSelectCoercedSchema),
});

export const ManifestCreateBodySchema = ManifestInsertSchema.omit({
  id: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
});

export const ManifestCreateResponseSchema = z.object({
  id: z.string().uuid(),
});

export const ManifestOkResponseSchema = z.object({
  ok: z.literal(true),
});

export const ManifestItemParamsSchema = z.object({
  id: ManifestByIdSchema.shape.id,
  itemId: z.string().uuid(),
});

export const ManifestItemsListResponseSchema = z.object({
  items: z.array(ManifestItemSelectCoercedSchema),
});

export const ManifestItemsCsvResponseSchema = z.string();

export const ManifestItemsAddBodySchema = z.object({
  items: z
    .array(
      ManifestItemInsertSchema.omit({
        id: true,
        manifestId: true,
        createdAt: true,
        updatedAt: true,
      })
    )
    .min(1),
});

export const ManifestItemsAddResponseSchema = z.object({
  inserted: z.number().int().min(0),
});

export const ManifestFullResponseSchema = z.object({
  manifest: ManifestSelectCoercedSchema,
  items: z.array(ManifestItemSelectCoercedSchema),
});

export const ManifestCloneParamsSchema = z.object({
  manifestId: z.string().uuid(),
});

export const ManifestCloneBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
});

export const ManifestCloneResponseSchema = z.object({
  id: z.string().uuid(),
  itemsCopied: z.number().int().min(0),
});
