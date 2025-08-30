import { z } from 'zod';

export const VatRateKindSchema = z.enum(['STANDARD', 'REDUCED', 'SUPER_REDUCED', 'ZERO']);
export type VatRateKind = z.infer<typeof VatRateKindSchema>;

// Your calculator supports these two bases today; keep schema tight.
export const VatBaseSchema = z.enum(['CIF', 'CIF_PLUS_DUTY']);
export type VatBase = z.infer<typeof VatBaseSchema>;

/** One LLM VAT row (country-level). Rates are in PERCENT units (e.g., 21 for 21%). */
export const LlmVatRow = z.object({
  country_code: z.string().length(2),
  vat_rate_kind: VatRateKindSchema.default('STANDARD'),
  vat_base: VatBaseSchema.default('CIF_PLUS_DUTY'),
  rate_pct: z.number().nonnegative(), // e.g., 21, 5, 0
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effective_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  source_url: z.string().url(),
  notes: z.string().max(2000).nullable().optional(),
});

export const LlmVatPayload = z.object({ rows: z.array(LlmVatRow).max(5000) });

export type LlmVat = z.infer<typeof LlmVatRow>;
