import z from 'zod/v4';
import {
  QuoteByKeyParamsSchema,
  QuoteExplainabilitySchema,
  QuoteInputSchema,
  QuoteRecentListResponseSchema,
  QuoteRecentQuerySchema,
  QuoteRecentRowSchema,
  QuoteReplayQuerySchema,
  QuoteResponseSchema,
  QuoteStatsResponseSchema,
} from '../schemas/quotes.js';

export type QuoteInput = z.infer<typeof QuoteInputSchema>;
export type QuoteResponse = z.infer<typeof QuoteResponseSchema>;
export type QuoteExplainability = z.infer<typeof QuoteExplainabilitySchema>;
export type QuoteRecentQuery = z.infer<typeof QuoteRecentQuerySchema>;
export type QuoteRecentRow = z.infer<typeof QuoteRecentRowSchema>;
export type QuoteRecentListResponse = z.infer<typeof QuoteRecentListResponseSchema>;
export type QuoteStatsResponse = z.infer<typeof QuoteStatsResponseSchema>;
export type QuoteByKeyParams = z.infer<typeof QuoteByKeyParamsSchema>;
export type QuoteReplayQuery = z.infer<typeof QuoteReplayQuerySchema>;
