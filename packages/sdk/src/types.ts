export type SDKOptions = {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof globalThis.fetch;
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
} from '@clearcost/types';
