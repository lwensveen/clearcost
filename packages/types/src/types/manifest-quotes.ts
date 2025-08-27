import { z } from 'zod/v4';
import {
  ManifestQuoteByIdSchema,
  ManifestQuoteInsertSchema,
  ManifestQuoteSelectCoercedSchema,
  ManifestQuoteSelectSchema,
  ManifestQuotesListQuerySchema,
  ManifestQuoteUpdateSchema,
} from '../schemas/manifest-quotes.js';

export type ManifestQuote = z.infer<typeof ManifestQuoteSelectSchema>;
export type ManifestQuoteCoerced = z.infer<typeof ManifestQuoteSelectCoercedSchema>;
export type ManifestQuoteInsert = z.infer<typeof ManifestQuoteInsertSchema>;
export type ManifestQuoteUpdate = z.infer<typeof ManifestQuoteUpdateSchema>;
export type ManifestQuoteById = z.infer<typeof ManifestQuoteByIdSchema>;
export type ManifestQuotesListQuery = z.infer<typeof ManifestQuotesListQuerySchema>;
