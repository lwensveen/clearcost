import { z } from 'zod/v4';

export const quoteInputSchema = z.object({
  origin: z.string().length(2),
  dest: z.string().length(2),
  itemValue: z.object({
    amount: z.number().positive(),
    currency: z.string().length(3),
  }),
  dimsCm: z.object({
    l: z.number().positive(),
    w: z.number().positive(),
    h: z.number().positive(),
  }),
  weightKg: z.number().positive(),
  categoryKey: z.string().min(1),
  incoterm: z.string().min(1),
  hs6: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  mode: z.enum(['air', 'sea']),
});

export const QuoteResponseSchema = z.object({
  hs6: z.string().regex(/^\d{6}$/),
  chargeableKg: z.number(),
  freight: z.number(),
  components: z.object({
    CIF: z.number(),
    duty: z.number(),
    vat: z.number(),
    fees: z.number(),
    checkoutVAT: z.number().optional(),
  }),
  total: z.number(),
  guaranteedMax: z.number(),
  policy: z.string(),
  incoterm: z.enum(['DAP', 'DDP']),
});

export type QuoteInput = z.infer<typeof quoteInputSchema>;
