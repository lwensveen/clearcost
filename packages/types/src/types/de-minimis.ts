import { z } from 'zod/v4';
import {
  DeMinimisByIdSchema,
  DeMinimisEvalBodySchema,
  DeMinimisEvalResponseSchema,
  DeMinimisInsertSchema,
  DeMinimisListQuerySchema,
  DeMinimisSelectCoercedSchema,
  DeMinimisSelectSchema,
  DeMinimisThresholdQuerySchema,
  DeMinimisThresholdResponseSchema,
  DeMinimisUpdateSchema,
} from '../schemas/index.js';

export type DeMinimis = z.infer<typeof DeMinimisSelectSchema>;
export type DeMinimisCoerced = z.infer<typeof DeMinimisSelectCoercedSchema>;
export type DeMinimisInsert = z.infer<typeof DeMinimisInsertSchema>;
export type DeMinimisUpdate = z.infer<typeof DeMinimisUpdateSchema>;
export type DeMinimisById = z.infer<typeof DeMinimisByIdSchema>;
export type DeMinimisListQuery = z.infer<typeof DeMinimisListQuerySchema>;
export type DeMinimisThresholdQuery = z.infer<typeof DeMinimisThresholdQuerySchema>;
export type DeMinimisThresholdResponse = z.infer<typeof DeMinimisThresholdResponseSchema>;
export type DeMinimisEvalBody = z.infer<typeof DeMinimisEvalBodySchema>;
export type DeMinimisEvalResponse = z.infer<typeof DeMinimisEvalResponseSchema>;
