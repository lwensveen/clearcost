import { randomInt } from 'node:crypto';

const DEFAULT_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS ?? 15000);
const DEFAULT_RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);

function isIdempotent(method?: string): boolean {
  const m = (method ?? 'GET').toUpperCase();
  return m === 'GET' || m === 'HEAD';
}

function mergeSignals(a?: AbortSignal | null, b?: AbortSignal | null): AbortSignal | undefined {
  if (!a) return b ?? undefined;
  if (!b) return a ?? undefined;
  const any = (AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal }).any;
  if (typeof any === 'function') return any([a, b]);

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  a.addEventListener('abort', onAbort, { once: true });
  b.addEventListener('abort', onAbort, { once: true });
  return controller.signal;
}

function defaultDelayMs(attempt: number): number {
  const base = Math.min(1000 * 2 ** attempt, 4000);
  return base + randomInt(0, 250);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export type HttpFetchInit = RequestInit & {
  timeoutMs?: number;
  retries?: number;
  retryOn?: (res: Response) => boolean;
  retryDelayMs?: (attempt: number) => number;
};

export async function httpFetch(
  input: RequestInfo | URL,
  init: HttpFetchInit = {}
): Promise<Response> {
  const { timeoutMs, retries, retryOn, retryDelayMs, ...reqInit } = init;
  const maxRetries = retries ?? (isIdempotent(reqInit.method) ? 2 : 0);
  const timeout = Number.isFinite(timeoutMs) ? Number(timeoutMs) : DEFAULT_TIMEOUT_MS;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const signal = mergeSignals(reqInit.signal, controller.signal);

    try {
      const res = await fetch(input, { ...reqInit, signal });
      clearTimeout(timeoutId);

      const shouldRetry = retryOn ? retryOn(res) : DEFAULT_RETRY_STATUS.has(res.status);
      if (!shouldRetry || attempt >= maxRetries) return res;
    } catch (err) {
      clearTimeout(timeoutId);
      if (attempt >= maxRetries) throw err;
    }

    await sleep((retryDelayMs ?? defaultDelayMs)(attempt));
  }

  throw new Error('httpFetch: unreachable');
}
