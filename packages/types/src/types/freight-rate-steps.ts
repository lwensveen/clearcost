import { z } from 'zod/v4';
import {
  FreightRateStepByIdSchema,
  FreightRateStepInsertSchema,
  FreightRateStepSelectCoercedSchema,
  FreightRateStepSelectSchema,
  FreightRateStepsListQuerySchema,
  FreightRateStepUpdateSchema,
} from '../schemas/index.js';

export type FreightRateStep = z.infer<typeof FreightRateStepSelectSchema>;
export type FreightRateStepCoerced = z.infer<typeof FreightRateStepSelectCoercedSchema>;
export type FreightRateStepInsert = z.infer<typeof FreightRateStepInsertSchema>;
export type FreightRateStepUpdate = z.infer<typeof FreightRateStepUpdateSchema>;
export type FreightRateStepById = z.infer<typeof FreightRateStepByIdSchema>;
export type FreightRateStepsListQuery = z.infer<typeof FreightRateStepsListQuerySchema>;
