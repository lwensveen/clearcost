import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { orgMembershipsTable } from '@clearcost/db';

export const OrgMembershipSelectSchema = createSelectSchema(orgMembershipsTable);
export const OrgMembershipInsertSchema = createInsertSchema(orgMembershipsTable);
export const OrgMembershipUpdateSchema = createUpdateSchema(orgMembershipsTable);

export const OrgMembershipSelectCoercedSchema = OrgMembershipSelectSchema.extend({
  // Explicit role enum matches the intended values; adjust if your DB allows more.
  role: z.enum(['owner', 'admin', 'member']),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
});

export const OrgMembershipByIdSchema = z.object({ id: z.string().uuid() });

export const OrgMembershipsListQuerySchema = z.object({
  orgId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});
