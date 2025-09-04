import { z } from 'zod/v4';
import {
  OrgMembershipByIdSchema,
  OrgMembershipInsertSchema,
  OrgMembershipSelectCoercedSchema,
  OrgMembershipSelectSchema,
  OrgMembershipsListQuerySchema,
  OrgMembershipUpdateSchema,
} from '../schemas/index.js';

export type OrgMembership = z.infer<typeof OrgMembershipSelectSchema>;
export type OrgMembershipCoerced = z.infer<typeof OrgMembershipSelectCoercedSchema>;
export type OrgMembershipInsert = z.infer<typeof OrgMembershipInsertSchema>;
export type OrgMembershipUpdate = z.infer<typeof OrgMembershipUpdateSchema>;
export type OrgMembershipById = z.infer<typeof OrgMembershipByIdSchema>;
export type OrgMembershipsListQuery = z.infer<typeof OrgMembershipsListQuerySchema>;
