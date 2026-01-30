import { z } from 'zod/v4';
import {
  FreightRateStepsListResponseSchema,
  FreightStepAdminCreateSchema,
  FreightStepAdminUpdateSchema,
  FreightStepIdParamSchema,
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
export type FreightRateStepsListResponse = z.infer<typeof FreightRateStepsListResponseSchema>;
export type FreightStepAdminCreate = z.infer<typeof FreightStepAdminCreateSchema>;
export type FreightStepAdminUpdate = z.infer<typeof FreightStepAdminUpdateSchema>;
export type FreightStepIdParam = z.infer<typeof FreightStepIdParamSchema>;
