import { z } from 'zod/v4';
import {
  ManifestComputeBodySchema,
  ManifestComputeResponseSchema,
  ManifestErrorResponseSchema,
  ManifestIdParamSchema,
  ManifestItemsImportQuerySchema,
  ManifestItemsImportResponseSchema,
  ManifestItemsReplaceBodySchema,
  ManifestItemsReplaceResponseSchema,
  ManifestQuotesByKeyParamsSchema,
  ManifestQuotesHistoryResponseSchema,
  ManifestQuotesResponseSchema,
} from '../schemas/index.js';

export type ManifestIdParam = z.infer<typeof ManifestIdParamSchema>;
export type ManifestComputeBody = z.infer<typeof ManifestComputeBodySchema>;
export type ManifestComputeResponse = z.infer<typeof ManifestComputeResponseSchema>;
export type ManifestQuotesResponse = z.infer<typeof ManifestQuotesResponseSchema>;
export type ManifestQuotesByKeyParams = z.infer<typeof ManifestQuotesByKeyParamsSchema>;
export type ManifestQuotesHistoryResponse = z.infer<typeof ManifestQuotesHistoryResponseSchema>;
export type ManifestItemsReplaceBody = z.infer<typeof ManifestItemsReplaceBodySchema>;
export type ManifestItemsReplaceResponse = z.infer<typeof ManifestItemsReplaceResponseSchema>;
export type ManifestItemsImportQuery = z.infer<typeof ManifestItemsImportQuerySchema>;
export type ManifestItemsImportResponse = z.infer<typeof ManifestItemsImportResponseSchema>;
export type ManifestErrorResponse = z.infer<typeof ManifestErrorResponseSchema>;
