import { z } from 'zod/v4';
import {
  DeMinimisByIdSchema,
  DeMinimisInsertSchema,
  DeMinimisListQuerySchema,
  DeMinimisSelectCoercedSchema,
  DeMinimisSelectSchema,
  DeMinimisUpdateSchema,
} from '../schemas/index.js';

export type DeMinimis = z.infer<typeof DeMinimisSelectSchema>;
export type DeMinimisCoerced = z.infer<typeof DeMinimisSelectCoercedSchema>;
export type DeMinimisInsert = z.infer<typeof DeMinimisInsertSchema>;
export type DeMinimisUpdate = z.infer<typeof DeMinimisUpdateSchema>;
export type DeMinimisById = z.infer<typeof DeMinimisByIdSchema>;
export type DeMinimisListQuery = z.infer<typeof DeMinimisListQuerySchema>;
