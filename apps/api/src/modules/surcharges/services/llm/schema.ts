import { z } from 'zod';

export const RateTypeSchema = z.enum(['ad_valorem', 'fixed', 'unit']);
export const ModeSchema = z.enum(['ALL', 'OCEAN', 'AIR', 'TRUCK', 'RAIL']);
export const LevelSchema = z.enum(['entry', 'line', 'shipment', 'program']); // keep in sync with DB enum subset

export const LlmSurchargeRow = z.object({
  country_code: z.string().length(2),
  origin_code: z.string().length(2).nullable().optional(),
  hs6: z
    .string()
    .regex(/^\d{6}$/)
    .nullable()
    .optional(),
  surcharge_code: z.string().min(2).max(32),
  rate_type: RateTypeSchema,
  pct_decimal: z.number().nullable().optional(),
  fixed_amount: z.number().nullable().optional(),
  unit_amount: z.number().nullable().optional(),
  unit_code: z.string().max(16).nullable().optional(),
  currency: z.string().length(3).optional(),
  min_amount: z.number().nullable().optional(),
  max_amount: z.number().nullable().optional(),
  apply_level: LevelSchema.default('entry'),
  value_basis: z.enum(['customs']).default('customs'),
  transport_mode: ModeSchema.default('ALL'),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effective_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  source_url: z.string().url(),
  notes: z.string().max(2000).nullable().optional(),
});

export type LlmSurcharge = z.infer<typeof LlmSurchargeRow>;
export const LlmSurchargePayload = z.object({ rows: z.array(LlmSurchargeRow).max(5000) });
