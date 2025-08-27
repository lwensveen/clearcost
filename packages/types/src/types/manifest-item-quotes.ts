import { z } from 'zod/v4';
import {
  ManifestItemQuoteByIdSchema,
  ManifestItemQuoteInsertSchema,
  ManifestItemQuoteSelectCoercedSchema,
  ManifestItemQuoteSelectSchema,
  ManifestItemQuotesListQuerySchema,
  ManifestItemQuoteUpdateSchema,
} from '../schemas/manifest-item-quotes.js';

export type ManifestItemQuote = z.infer<typeof ManifestItemQuoteSelectSchema>;
export type ManifestItemQuoteCoerced = z.infer<typeof ManifestItemQuoteSelectCoercedSchema>;
export type ManifestItemQuoteInsert = z.infer<typeof ManifestItemQuoteInsertSchema>;
export type ManifestItemQuoteUpdate = z.infer<typeof ManifestItemQuoteUpdateSchema>;
export type ManifestItemQuoteById = z.infer<typeof ManifestItemQuoteByIdSchema>;
export type ManifestItemQuotesListQuery = z.infer<typeof ManifestItemQuotesListQuerySchema>;
