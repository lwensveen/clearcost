import { z } from 'zod/v4';
import {
  ApiKeyAdminCreateBodySchema,
  ApiKeyAdminGetResponseSchema,
  ApiKeyAdminListQuerySchema,
  ApiKeyAdminListResponseSchema,
  ApiKeyAdminPatchBodySchema,
  ApiKeyAdminRotateBodySchema,
  ApiKeyAdminRotateResponseSchema,
  ApiKeyCreateResponseSchema,
  ApiKeyCreateSchema,
  ApiKeyIdParamSchema,
  ApiKeyPublicSchema,
  ApiKeySelfResponseSchema,
  ApiKeySelfRevokeResponseSchema,
  ApiKeySelfRotateResponseSchema,
  ApiKeyStatusResponseSchema,
} from '../schemas/index.js';

export type CreateApiKeyInput = z.infer<typeof ApiKeyCreateSchema>;
export type CreateApiKeyResult = z.infer<typeof ApiKeyCreateResponseSchema>;
export type ApiKeyPublic = z.infer<typeof ApiKeyPublicSchema>;
export type ApiKeyIdParam = z.infer<typeof ApiKeyIdParamSchema>;
export type ApiKeyAdminListQuery = z.infer<typeof ApiKeyAdminListQuerySchema>;
export type ApiKeyAdminListResponse = z.infer<typeof ApiKeyAdminListResponseSchema>;
export type ApiKeyAdminCreateBody = z.infer<typeof ApiKeyAdminCreateBodySchema>;
export type ApiKeyAdminGetResponse = z.infer<typeof ApiKeyAdminGetResponseSchema>;
export type ApiKeyAdminPatchBody = z.infer<typeof ApiKeyAdminPatchBodySchema>;
export type ApiKeyAdminRotateBody = z.infer<typeof ApiKeyAdminRotateBodySchema>;
export type ApiKeyAdminRotateResponse = z.infer<typeof ApiKeyAdminRotateResponseSchema>;
export type ApiKeyStatusResponse = z.infer<typeof ApiKeyStatusResponseSchema>;
export type ApiKeySelfResponse = z.infer<typeof ApiKeySelfResponseSchema>;
export type ApiKeySelfRotateResponse = z.infer<typeof ApiKeySelfRotateResponseSchema>;
export type ApiKeySelfRevokeResponse = z.infer<typeof ApiKeySelfRevokeResponseSchema>;
