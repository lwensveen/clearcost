import { publicApi } from './api-client';
import type { QuoteInput, QuoteResponse } from '@clearcost/types';

export async function listRecent(limit = 50): Promise<{ rows: any[] }> {
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
  const res = await api.fetchRaw(`/v1/quotes`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Idempotency-Key': idem },
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text || 'request failed';
    try {
      const j = JSON.parse(text);
      msg = j?.error ?? j?.message ?? msg;
    } catch {}
    throw new Error(`${res.status} ${msg}`);
  }
  const data = text ? (JSON.parse(text) as QuoteResponse) : (null as unknown as QuoteResponse);
  return { quote: data, idempotencyKey: idem };
}
