import { z } from 'zod/v4';

export const MetaHealthResponseSchema = z.object({ ok: z.literal(true) });

export const MetaVersionResponseSchema = z.object({
  name: z.string(),
  version: z.string(),
  gitSha: z.string().optional(),
  buildTime: z.string().optional(),
});
