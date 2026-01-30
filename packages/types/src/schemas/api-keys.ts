import { z } from 'zod/v4';
import { ErrorResponseSchema } from './errors.js';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { apiKeysTable } from '@clearcost/db';

export const ApiKeySelectSchema = createSelectSchema(apiKeysTable);
export const ApiKeyInsertSchema = createInsertSchema(apiKeysTable);
export const ApiKeyUpdateSchema = createUpdateSchema(apiKeysTable);

export const ApiKeyRecordSchema = ApiKeySelectSchema.extend({
  lastUsedAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
});

export const ApiKeyCreateSchema = z.object({
  name: z.string().min(1),
  ownerId: z.string().uuid(),
  scopes: z.array(z.string()).default([]),
});

export const ApiKeyPublicSchema = z.object({
  id: z.string().uuid(),
  keyId: z.string(),
  prefix: z.string(),
  ownerId: z.string().uuid(),
  name: z.string(),
  scopes: z.array(z.string()),
  isActive: z.boolean(),
  expiresAt: z.coerce.date().nullable(),
  revokedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date().nullable(),
  lastUsedAt: z.coerce.date().nullable(),
});

export const ApiKeyCreateResponseSchema = z.object({
  id: z.string().uuid(),
  token: z.string(),
  keyId: z.string(),
  prefix: z.string(),
  name: z.string(),
  ownerId: z.string().uuid(),
  scopes: z.array(z.string()),
  isActive: z.boolean(),
  createdAt: z.coerce.date().nullable(),
});

export const ApiKeyIdParamSchema = z.object({ id: z.string().uuid() });

export const ApiKeyAdminListQuerySchema = z.object({
  ownerId: z.string().uuid(),
  activeOnly: z.coerce.boolean().default(true),
});

export const ApiKeyAdminListResponseSchema = z.array(ApiKeyPublicSchema);

export const ApiKeyAdminCreateBodySchema = z.object({
  ownerId: z.string().uuid(),
  name: z.string().min(1),
  scopes: z.array(z.string()).default([]),
  prefix: z.enum(['live', 'test']).default('live'),
  expiresAt: z.coerce.date().optional(),
  allowedCidrs: z.array(z.string()).optional(),
  allowedOrigins: z.array(z.string()).optional(),
  rateLimitPerMin: z.number().int().positive().optional(),
});

export const ApiKeyAdminGetResponseSchema = ApiKeyPublicSchema;

export const ApiKeyAdminPatchBodySchema = z.object({
  name: z.string().min(1).optional(),
  scopes: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  allowedCidrs: z.array(z.string()).optional(),
  allowedOrigins: z.array(z.string()).optional(),
  rateLimitPerMin: z.number().int().positive().nullable().optional(),
  revoke: z.boolean().optional(),
});

export const ApiKeyStatusResponseSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
  revokedAt: z.coerce.date().nullable(),
  updatedAt: z.coerce.date().nullable(),
});

export const ApiKeyAdminRotateBodySchema = z.object({
  name: z.string().min(1).optional(),
  prefix: z.enum(['live', 'test']).optional(),
  scopes: z.array(z.string()).optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  allowedCidrs: z.array(z.string()).optional(),
  allowedOrigins: z.array(z.string()).optional(),
  rateLimitPerMin: z.number().int().positive().nullable().optional(),
});

export const ApiKeyAdminRotateResponseSchema = ApiKeyCreateResponseSchema;

export const ApiKeySelfResponseSchema = ApiKeyPublicSchema;
export const ApiKeySelfRotateResponseSchema = ApiKeyCreateResponseSchema;
export const ApiKeySelfRevokeResponseSchema = ApiKeyStatusResponseSchema;

export const ApiKeyErrorResponseSchema = ErrorResponseSchema;
