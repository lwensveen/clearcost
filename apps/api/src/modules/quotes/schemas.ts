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
  userHs6: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  mode: z.enum(['air', 'sea']),
});

export type QuoteInput = z.infer<typeof quoteInputSchema>;
