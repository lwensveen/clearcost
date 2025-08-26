import { z } from 'zod/v4';
import {
  HsAliasByIdSchema,
  HsAliasInsertSchema,
  HsAliasSelectCoercedSchema,
  HsAliasSelectSchema,
  HsAliasUpdateSchema,
} from '../schemas/index.js';

export type HsAlias = z.infer<typeof HsAliasSelectSchema>;
export type HsAliasCoerced = z.infer<typeof HsAliasSelectCoercedSchema>;
export type HsAliasInsert = z.infer<typeof HsAliasInsertSchema>;
export type HsAliasUpdate = z.infer<typeof HsAliasUpdateSchema>;
export type HsAliasById = z.infer<typeof HsAliasByIdSchema>;
