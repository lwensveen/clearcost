import { z } from 'zod/v4';

export const UsageRangeQuerySchema = z.object({
  // YYYY-MM-DD in UTC
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const UsageRowSchema = z.object({
  day: z.any(), // date (returned as Date by drizzle)
  route: z.string(),
  method: z.string(),
  count: z.number(),
  sumDurationMs: z.number(),
  sumBytesIn: z.number(),
  sumBytesOut: z.number(),
});

export const UsageResponseSchema = z.array(UsageRowSchema);

export const UsageByKeyParamsSchema = z.object({
  apiKeyId: z.string().uuid(),
});
