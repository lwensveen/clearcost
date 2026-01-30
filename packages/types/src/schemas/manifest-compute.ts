import { z } from 'zod/v4';
import { ManifestItemInsertSchema } from './manifest-items.js';
import { ErrorResponseSchema } from './errors.js';

export const ManifestIdParamSchema = z.object({ manifestId: z.string().uuid() });

export const ManifestComputeBodySchema = z.object({
  allocation: z.enum(['chargeable', 'volumetric', 'weight']).default('chargeable'),
  dryRun: z.coerce.boolean().default(false),
});

export const ManifestComputeResponseSchema = z.object({
  ok: z.literal(true),
  manifestId: z.string().uuid(),
  allocation: z.enum(['chargeable', 'volumetric', 'weight']),
  dryRun: z.boolean(),
  summary: z.unknown().nullable(),
  items: z.array(z.unknown()),
});

export const ManifestQuotesResponseSchema = z.object({
  ok: z.literal(true),
  manifestId: z.string().uuid(),
  summary: z.unknown().nullable(),
  items: z.array(z.unknown()),
});

export const ManifestQuotesByKeyParamsSchema = z.object({
  manifestId: z.string().uuid(),
  key: z.string().min(1),
});

export const ManifestQuotesHistoryItemSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.coerce.date().nullable(),
  idemKey: z.string(),
  allocation: z.string(),
  dryRun: z.boolean(),
});

export const ManifestQuotesHistoryResponseSchema = z.object({
  items: z.array(ManifestQuotesHistoryItemSchema),
});

export const ManifestItemsReplaceBodySchema = z.object({
  items: z
    .array(
      ManifestItemInsertSchema.omit({
        id: true,
        manifestId: true,
        createdAt: true,
        updatedAt: true,
      })
    )
    .min(0),
  dryRun: z.coerce.boolean().default(false),
});

export const ManifestItemsReplaceResponseSchema = z.object({
  replaced: z.number().int().min(0),
});

export const ManifestItemsImportQuerySchema = z.object({
  mode: z.enum(['append', 'replace']).default('append'),
  dryRun: z.coerce.boolean().default(false),
});

export const ManifestItemsImportResponseSchema = z.object({
  mode: z.enum(['append', 'replace']),
  dryRun: z.boolean(),
  valid: z.number().int(),
  invalid: z.number().int(),
  inserted: z.number().int(),
  replaced: z.number().int().optional(),
  errors: z.array(z.object({ line: z.number().int(), message: z.string() })),
});

export const ManifestErrorResponseSchema = ErrorResponseSchema;
