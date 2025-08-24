import { z } from 'zod/v4';
import { ApiKeyCreateResponseSchema, ApiKeyCreateSchema } from '../schemas/index.js';

export type CreateApiKeyInput = z.infer<typeof ApiKeyCreateSchema>;
export type CreateApiKeyResult = z.infer<typeof ApiKeyCreateResponseSchema>;
