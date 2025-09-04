import { z } from 'zod/v4';

export const ManifestModeSchema = z.enum(['air', 'sea']);

export const MoneyInputSchema = z.object({
  amount: z.number(),
  currency: z.string().length(3),
});

export const DimsCmInputSchema = z.object({
  l: z.number(),
  w: z.number(),
  h: z.number(),
});

export const ManifestItemInputSchema = z.object({
  origin: z.string().min(2),
  dest: z.string().min(2),
  itemValue: MoneyInputSchema,
  dimsCm: DimsCmInputSchema,
  weightKg: z.number().nonnegative(),
  categoryKey: z.string().min(1),
  hs6: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});

export const ManifestCreateInputSchema = z.object({
  name: z.string().min(1).optional(),
  mode: ManifestModeSchema,
  items: z.array(ManifestItemInputSchema),
});

export const ManifestSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string().optional(),
  mode: ManifestModeSchema.optional(),
  status: z.string().optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
});

export const ManifestDetailSchema = ManifestSummarySchema.extend({
  items: z.array(ManifestItemInputSchema).optional(),
  totals: z.record(z.string(), z.unknown()).optional(),
  quote: z.record(z.string(), z.unknown()).optional(),
});

export const ListManifestsResultSchema = z.object({
  rows: z.array(ManifestSummarySchema),
  nextCursor: z.string().nullable().optional(),
});
