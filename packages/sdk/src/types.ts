export type RetryOptions = {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial backoff delay in milliseconds (default: 500) */
  initialDelayMs?: number;
  /** Maximum backoff delay in milliseconds (default: 30_000) */
  maxDelayMs?: number;
  /** HTTP status codes that trigger a retry (default: [429, 500, 502, 503, 504]) */
  retryableStatuses?: number[];
};

export type SDKOptions = {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof globalThis.fetch;
  /** Retry configuration. Set to `false` to disable retries entirely. */
  retry?: RetryOptions | false;
};

export type IdemOptions = {
  idempotencyKey?: string;
};

export type {
  QuoteInput,
  QuoteResponse,
  ClassifyInput,
  ClassifyResponse,
  ManifestCreateInput,
  ManifestSummary,
  ManifestDetail,
  ListManifestsResult,
  ManifestItemQuote,
  ManifestQuote,
  ManifestComputeResponse,
  ManifestQuotesResponse,
  ManifestQuotesHistoryResponse,
  ManifestItemsImportResponse,
} from '@clearcost/types';
