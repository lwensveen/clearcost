import { z } from 'zod/v4';
import {
  HsCodeByIdSchema,
  HsCodeInsertSchema,
  HsCodeSearchQuerySchema,
  HsCodeSelectCoercedSchema,
  HsCodeSelectSchema,
  HsCodeUpdateSchema,
} from '../schemas/index.js';

export type HsCode = z.infer<typeof HsCodeSelectSchema>;
export type HsCodeCoerced = z.infer<typeof HsCodeSelectCoercedSchema>;
export type HsCodeInsert = z.infer<typeof HsCodeInsertSchema>;
export type HsCodeUpdate = z.infer<typeof HsCodeUpdateSchema>;
export type HsCodeById = z.infer<typeof HsCodeByIdSchema>;
export type HsCodeSearchQuery = z.infer<typeof HsCodeSearchQuerySchema>;
