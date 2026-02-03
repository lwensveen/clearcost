import { z } from 'zod/v4';
import {
  ManifestByIdSchema,
  ManifestCloneBodySchema,
  ManifestCloneParamsSchema,
  ManifestCloneResponseSchema,
  ManifestCreateBodySchema,
  ManifestCreateResponseSchema,
  ManifestFullResponseSchema,
  ManifestItemParamsSchema,
  ManifestItemsAddBodySchema,
  ManifestItemsAddResponseSchema,
  ManifestItemsCsvResponseSchema,
  ManifestItemsListResponseSchema,
  ManifestOkResponseSchema,
  ManifestInsertSchema,
  ManifestSelectCoercedSchema,
  ManifestSelectSchema,
  ManifestsListResponseSchema,
  ManifestsListQuerySchema,
  ManifestUpdateSchema,
} from '../schemas/manifests.js';

export type Manifest = z.infer<typeof ManifestSelectSchema>;
export type ManifestCoerced = z.infer<typeof ManifestSelectCoercedSchema>;
export type ManifestInsert = z.infer<typeof ManifestInsertSchema>;
export type ManifestUpdate = z.infer<typeof ManifestUpdateSchema>;
export type ManifestById = z.infer<typeof ManifestByIdSchema>;
export type ManifestsListQuery = z.infer<typeof ManifestsListQuerySchema>;
export type ManifestsListResponse = z.infer<typeof ManifestsListResponseSchema>;
export type ManifestCreateBody = z.infer<typeof ManifestCreateBodySchema>;
export type ManifestCreateResponse = z.infer<typeof ManifestCreateResponseSchema>;
export type ManifestOkResponse = z.infer<typeof ManifestOkResponseSchema>;
export type ManifestItemParams = z.infer<typeof ManifestItemParamsSchema>;
export type ManifestItemsListResponse = z.infer<typeof ManifestItemsListResponseSchema>;
export type ManifestItemsCsvResponse = z.infer<typeof ManifestItemsCsvResponseSchema>;
export type ManifestItemsAddBody = z.infer<typeof ManifestItemsAddBodySchema>;
export type ManifestItemsAddResponse = z.infer<typeof ManifestItemsAddResponseSchema>;
export type ManifestFullResponse = z.infer<typeof ManifestFullResponseSchema>;
export type ManifestCloneParams = z.infer<typeof ManifestCloneParamsSchema>;
export type ManifestCloneBody = z.infer<typeof ManifestCloneBodySchema>;
export type ManifestCloneResponse = z.infer<typeof ManifestCloneResponseSchema>;
