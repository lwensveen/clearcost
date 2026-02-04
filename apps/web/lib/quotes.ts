import { publicApi } from './api-client';
import type {
  QuoteInput,
  QuoteRecentListResponse,
  QuoteRecentRow,
  QuoteResponse,
} from '@clearcost/types';

export type RecentQuoteRow = QuoteRecentRow;

export async function listRecent(limit = 50): Promise<QuoteRecentListResponse> {
  const api = publicApi();
  return api.fetchJson<QuoteRecentListResponse>(`/v1/quotes/recent?limit=${limit}`);
}

export async function getByKey(key: string): Promise<QuoteResponse> {
  const api = publicApi();
  return api.fetchJson(`/v1/quotes/by-key/${encodeURIComponent(key)}`);
}

export async function create(
  body: QuoteInput
): Promise<{ quote: QuoteResponse; idempotencyKey: string }> {
  const api = publicApi();
  const idem = api.genIdemKey();
  const quote = await api.fetchJson<QuoteResponse>(`/v1/quotes`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Idempotency-Key': idem },
  });
  return { quote, idempotencyKey: idem };
}
