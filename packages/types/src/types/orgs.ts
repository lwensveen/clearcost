import { z } from 'zod/v4';
import {
  OrgByIdSchema,
  OrgInsertSchema,
  OrgSelectCoercedSchema,
  OrgSelectSchema,
  OrgsListQuerySchema,
  OrgUpdateSchema,
} from '../schemas/index.js';

export type Org = z.infer<typeof OrgSelectSchema>;
export type OrgCoerced = z.infer<typeof OrgSelectCoercedSchema>;
export type OrgInsert = z.infer<typeof OrgInsertSchema>;
export type OrgUpdate = z.infer<typeof OrgUpdateSchema>;
export type OrgById = z.infer<typeof OrgByIdSchema>;
export type OrgsListQuery = z.infer<typeof OrgsListQuerySchema>;
