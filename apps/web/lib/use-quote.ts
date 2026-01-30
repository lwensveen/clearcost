'use client';

import useSWR from 'swr';
import { ManifestQuoteResponseSchema, type ManifestQuoteResponse } from '@clearcost/types';

const fetcher = async (url: string): Promise<ManifestQuoteResponse> => {
  const r = await fetch(url, { cache: 'no-store' });
  const raw = await r.json();
  return ManifestQuoteResponseSchema.parse(raw);
};

export function useQuote(manifestId: string) {
  return useSWR<ManifestQuoteResponse>(`/api/cc/quote?manifestId=${manifestId}`, fetcher, {
    refreshInterval: 2000, // poll
    shouldRetryOnError: false,
  });
}
