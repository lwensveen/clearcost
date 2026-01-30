import { z } from 'zod/v4';

export const ClassifyInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  categoryKey: z.string().optional(),
  origin: z.string().length(2).optional(),
});

export const ClassifyResponseSchema = z.object({
  hs6: z.string().regex(/^\d{6}$/),
  confidence: z.number().min(0).max(1),
  candidates: z
    .array(
      z.object({
        hs6: z.string().regex(/^\d{6}$/),
        title: z.string(),
        score: z.number(),
      })
    )
    .optional(),
});
