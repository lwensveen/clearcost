import { z } from 'zod/v4';

export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.unknown().optional(),
  }),
});

export const ErrorResponseSchema = ErrorEnvelopeSchema;
