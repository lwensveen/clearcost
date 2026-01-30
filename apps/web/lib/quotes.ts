import { publicApi } from './api-client';
import type { QuoteInput, QuoteResponse } from '@clearcost/types';

export type RecentQuoteRow = {
  createdAt: string;
  idemKey: string;
  origin: string;
  dest: string;
  mode?: 'air' | 'sea' | null;
  hs6?: string | null;
  currency?: string | null;
  itemValue?: number | null;
  total: number;
  duty: number;
  vat?: number | null;
  fees: number;
};

export async function listRecent(limit = 50): Promise<{ rows: RecentQuoteRow[] }> {
  const api = publicApi();
  return api.fetchJson(`/v1/quotes/recent?limit=${limit}`);
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
