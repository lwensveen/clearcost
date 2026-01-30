import { z } from 'zod/v4';
import {
  FxRateByIdSchema,
  FxRateInsertSchema,
  FxRateSelectCoercedSchema,
  FxRateSelectSchema,
  FxRatesListQuerySchema,
  FxRateUpdateSchema,
  FxRefreshResponseSchema,
} from '../schemas/fx-rates.js';

export type FxRate = z.infer<typeof FxRateSelectSchema>;
export type FxRateCoerced = z.infer<typeof FxRateSelectCoercedSchema>;
export type FxRateInsert = z.infer<typeof FxRateInsertSchema>;
export type FxRateUpdate = z.infer<typeof FxRateUpdateSchema>;
export type FxRateById = z.infer<typeof FxRateByIdSchema>;
export type FxRatesListQuery = z.infer<typeof FxRatesListQuerySchema>;
export type FxRefreshResponse = z.infer<typeof FxRefreshResponseSchema>;
