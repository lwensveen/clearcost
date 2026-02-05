import { z } from 'zod/v4';
import {
  HealthFreshnessResponseSchema,
  HealthImportsQuerySchema,
  HealthImportsResponseSchema,
  HealthSchema,
} from '../schemas/index.js';

export type Health = z.infer<typeof HealthSchema>;
export type HealthImportsQuery = z.infer<typeof HealthImportsQuerySchema>;
export type HealthImportsResponse = z.infer<typeof HealthImportsResponseSchema>;
export type HealthFreshnessResponse = z.infer<typeof HealthFreshnessResponseSchema>;
