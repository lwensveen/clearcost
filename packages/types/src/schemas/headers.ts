import { z } from 'zod/v4';

export const IdempotencyHeaderSchema = z
  .object({
    'idempotency-key': z.string().min(1).optional(),
    'x-idempotency-key': z.string().min(1).optional(),
  })
  .refine(
    (h) => !!(h['idempotency-key'] || h['x-idempotency-key']),
    'Idempotency-Key header required'
  );

export const NoContentResponseSchema = z.void();
