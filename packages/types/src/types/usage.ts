import { z } from 'zod/v4';
import {
  UsageByKeyParamsSchema,
  UsageRangeQuerySchema,
  UsageResponseSchema,
} from '../schemas/index.js';

export type UsageRangeQuery = z.infer<typeof UsageRangeQuerySchema>;
export type UsageResponse = z.infer<typeof UsageResponseSchema>;
export type UsageByKeyParams = z.infer<typeof UsageByKeyParamsSchema>;
