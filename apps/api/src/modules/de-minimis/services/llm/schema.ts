import { z } from 'zod/v4';

export const RowSchema = z.object({
  country_code: z.string().length(2),
  kind: z.enum(['DUTY', 'VAT']),
  basis: z.enum(['INTRINSIC', 'CIF']),
  currency: z.string().length(3),
  value: z.number().nonnegative(),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effective_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  source_url: z.string().url(),
  source_note: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});
export const PayloadSchema = z.object({ rows: z.array(RowSchema).max(2000) });
