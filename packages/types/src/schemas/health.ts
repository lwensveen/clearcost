import { z } from 'zod/v4';

export const HealthSchema = z.object({
  ok: z.boolean(),
  service: z.string().default('clearcost-api'),
  time: z.object({
    server: z.string(),
    uptimeSec: z.number(),
    tz: z.string(),
  }),
  db: z.object({
    ok: z.boolean(),
    latencyMs: z.number().nullable(),
  }),
  fxCache: z.object({
    ok: z.boolean().nullable(),
    latest: z.string().nullable(),
    ageHours: z.number().nullable(),
    maxAgeHours: z.number(),
  }),
  version: z.object({
    commit: z.string().nullable(),
    env: z.string(),
  }),
  durationMs: z.number(),
});

export const HealthImportsQuerySchema = z.object({
  thresholdHours: z.coerce
    .number()
    .int()
    .positive()
    .max(24 * 14)
    .default(36),
});

export const HealthImportsResponseSchema = z.object({
  now: z.coerce.date(),
  thresholdHours: z.number(),
  imports: z.array(
    z.object({
      id: z.string(),
      lastAt: z.coerce.date().nullable(),
      ok: z.boolean(),
      rows24h: z.number(),
      total: z.number(),
    })
  ),
});
