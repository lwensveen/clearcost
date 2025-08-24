import { z } from 'zod/v4';
import {
  DutyRateByIdSchema,
  DutyRateInsertSchema,
  DutyRateSelectCoercedSchema,
  DutyRateSelectSchema,
  DutyRatesListQuerySchema,
  DutyRateUpdateSchema,
} from '../schemas/index.js';

export type DutyRate = z.infer<typeof DutyRateSelectSchema>;
export type DutyRateCoerced = z.infer<typeof DutyRateSelectCoercedSchema>;
export type DutyRateInsert = z.infer<typeof DutyRateInsertSchema>;
export type DutyRateUpdate = z.infer<typeof DutyRateUpdateSchema>;
export type DutyRateById = z.infer<typeof DutyRateByIdSchema>;
export type DutyRatesListQuery = z.infer<typeof DutyRatesListQuerySchema>;
