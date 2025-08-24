import { z } from 'zod/v4';
import {
  SurchargeByIdSchema,
  SurchargeInsertSchema,
  SurchargeSelectCoercedSchema,
  SurchargeSelectSchema,
  SurchargesListQuerySchema,
  SurchargeUpdateSchema,
} from '../schemas/index.js';

export type Surcharge = z.infer<typeof SurchargeSelectSchema>;
export type SurchargeCoerced = z.infer<typeof SurchargeSelectCoercedSchema>;
export type SurchargeInsert = z.infer<typeof SurchargeInsertSchema>;
export type SurchargeUpdate = z.infer<typeof SurchargeUpdateSchema>;
export type SurchargeById = z.infer<typeof SurchargeByIdSchema>;
export type SurchargesListQuery = z.infer<typeof SurchargesListQuerySchema>;
