import { z } from 'zod/v4';
import { IdempotencyHeaderSchema } from '../schemas/index.js';

export type IdempotencyHeader = z.infer<typeof IdempotencyHeaderSchema>;
