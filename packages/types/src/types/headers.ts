import { z } from 'zod/v4';
import { IdempotencyHeaderSchema, NoContentResponseSchema } from '../schemas/index.js';

export type IdempotencyHeader = z.infer<typeof IdempotencyHeaderSchema>;
export type NoContentResponse = z.infer<typeof NoContentResponseSchema>;
