import { z } from 'zod/v4';
import {
  DutyRateComponentByIdSchema,
  DutyRateComponentInsertSchema,
  DutyRateComponentSelectCoercedSchema,
  DutyRateComponentSelectSchema,
  DutyRateComponentsListQuerySchema,
  DutyRateComponentUpdateSchema,
} from '../schemas/duty-rate-components.js';

export type DutyRateComponent = z.infer<typeof DutyRateComponentSelectSchema>;
export type DutyRateComponentCoerced = z.infer<typeof DutyRateComponentSelectCoercedSchema>;
export type DutyRateComponentInsert = z.infer<typeof DutyRateComponentInsertSchema>;
export type DutyRateComponentUpdate = z.infer<typeof DutyRateComponentUpdateSchema>;
export type DutyRateComponentById = z.infer<typeof DutyRateComponentByIdSchema>;
export type DutyRateComponentsListQuery = z.infer<typeof DutyRateComponentsListQuerySchema>;
