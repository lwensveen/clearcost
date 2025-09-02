'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((r) => r.json());

export function useQuote(manifestId: string) {
  return useSWR(`/api/cc/quote?manifestId=${manifestId}`, fetcher, {
    refreshInterval: 2000, // poll
    shouldRetryOnError: false,
  });
}
