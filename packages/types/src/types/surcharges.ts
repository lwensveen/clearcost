import { z } from 'zod/v4';
import {
  SurchargeByIdSchema,
  SurchargeInsertSchema,
  SurchargeSelectCoercedSchema,
  SurchargeSelectSchema,
  SurchargesAdminImportBodySchema,
  SurchargesAdminImportResponseSchema,
  SurchargesAdminListQuerySchema,
  SurchargesAdminListResponseSchema,
  SurchargesListQuerySchema,
  SurchargeUpdateSchema,
} from '../schemas/index.js';

export type Surcharge = z.infer<typeof SurchargeSelectSchema>;
export type SurchargeCoerced = z.infer<typeof SurchargeSelectCoercedSchema>;
export type SurchargeInsert = z.infer<typeof SurchargeInsertSchema>;
export type SurchargeUpdate = z.infer<typeof SurchargeUpdateSchema>;
export type SurchargeById = z.infer<typeof SurchargeByIdSchema>;
export type SurchargesListQuery = z.infer<typeof SurchargesListQuerySchema>;
export type SurchargesAdminListQuery = z.infer<typeof SurchargesAdminListQuerySchema>;
export type SurchargesAdminListResponse = z.infer<typeof SurchargesAdminListResponseSchema>;
export type SurchargesAdminImportBody = z.infer<typeof SurchargesAdminImportBodySchema>;
export type SurchargesAdminImportResponse = z.infer<typeof SurchargesAdminImportResponseSchema>;
