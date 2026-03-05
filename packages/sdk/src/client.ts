import {
  ClassifyInput,
  ClassifyResponse,
  IdemOptions,
  ListManifestsResult,
  ManifestComputeResponse,
  ManifestCreateInput,
  ManifestDetail,
  ManifestItemsImportResponse,
  ManifestQuotesHistoryResponse,
  ManifestQuotesResponse,
  QuoteInput,
  QuoteResponse,
  RetryOptions,
  SDKOptions,
} from './types.js';

// -------------------------------
// Idempotency helpers
// -------------------------------
export async function genIdemKey(): Promise<string> {
  const g: any = globalThis as any;
  const bytes = new Uint8Array(16);

  if (g.crypto?.getRandomValues) {
    g.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = (Math.random() * 256) | 0;
  }

  let base64: string;
  if (typeof g.btoa === 'function') {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
    base64 = g.btoa(bin);
  } else {
    base64 = Buffer.from(bytes).toString('base64');
  }

  const b64url = base64.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `ck_idem_${b64url}`;
}

// -------------------------------
// Internal HTTP helper
// -------------------------------
type HttpInit = RequestInit & { idem?: string };

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

// Retry defaults
const DEFAULT_RETRY: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 30_000,
  retryableStatuses: [429, 500, 502, 503, 504],
};

/** Visible for testing — override in tests to avoid real timers. */
export let _sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Replace the internal sleep function (useful in tests to avoid real delays).
 * Returns the previous sleep so it can be restored.
 */
export function _setSleep(fn: (ms: number) => Promise<void>): (ms: number) => Promise<void> {
  const prev = _sleep;
  _sleep = fn;
  return prev;
}

/**
 * Compute exponential backoff with full jitter.
 * delay = random(0, min(maxDelay, initialDelay * 2^attempt))
 */
function backoffDelay(attempt: number, initial: number, max: number): number {
  const exp = Math.min(max, initial * 2 ** attempt);
  return Math.floor(Math.random() * exp);
}

/**
 * Parse the Retry-After header value (seconds or HTTP-date) into milliseconds.
 * Returns undefined if the header is absent or unparseable.
 */
function parseRetryAfter(res: Response): number | undefined {
  const header = res.headers.get('retry-after');
  if (!header) return undefined;

  // Numeric seconds
  const secs = Number(header);
  if (!Number.isNaN(secs) && secs > 0) return secs * 1000;

  // HTTP-date
  const date = new Date(header).getTime();
  if (!Number.isNaN(date)) {
    const delta = date - Date.now();
    return delta > 0 ? delta : 0;
  }

  return undefined;
}

async function http<T = unknown>(
  opts: SDKOptions,
  path: string,
  init: HttpInit = {}
): Promise<{ data: T; idemKey?: string }> {
  if (!opts.baseUrl) throw new Error('SDK baseUrl is required');
  if (!opts.apiKey) throw new Error('SDK apiKey is required');

  const f = opts.fetch ?? fetch;
  const headers: Record<string, string> = {
    authorization: `Bearer ${opts.apiKey}`,
    ...(init.method && init.method !== 'GET' ? { 'content-type': 'application/json' } : {}),
    ...(init.idem ? { 'Idempotency-Key': init.idem } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };

  const retryConfig =
    opts.retry === false
      ? { ...DEFAULT_RETRY, maxRetries: 0 }
      : { ...DEFAULT_RETRY, ...opts.retry };

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    // Wait before retrying (skip delay on first attempt)
    if (attempt > 0) {
      await _sleep(backoffDelay(attempt - 1, retryConfig.initialDelayMs, retryConfig.maxDelayMs));
    }

    let res: Response;
    try {
      res = await f(joinUrl(opts.baseUrl, path), { ...init, headers, cache: 'no-store' });
    } catch (err: any) {
      // Network-level errors (DNS, connection refused, etc.) — retryable
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retryConfig.maxRetries) continue;
      throw lastError;
    }

    const idemKey = res.headers.get('Idempotency-Key') ?? undefined;
    const text = await res.text();
    const ctype = res.headers.get('content-type') ?? '';

    if (!res.ok) {
      // Check if this status is retryable
      if (retryConfig.retryableStatuses.includes(res.status) && attempt < retryConfig.maxRetries) {
        // Honour Retry-After header when present (e.g. 429)
        const retryAfterMs = parseRetryAfter(res);
        if (retryAfterMs !== undefined) {
          const clamped = Math.min(retryAfterMs, retryConfig.maxDelayMs);
          await _sleep(clamped);
        }
        continue;
      }

      // Non-retryable or final attempt — throw
      try {
        const j = text ? JSON.parse(text) : null;
        const msg = j?.error?.message ?? j?.error ?? j?.message ?? (text || 'request failed');
        throw new Error(`${res.status} ${msg}`);
      } catch (e) {
        if (e instanceof Error && e.message.startsWith(`${res.status} `)) throw e;
        throw new Error(`${res.status} ${text || 'request failed'}`);
      }
    }

    // Parse JSON when possible, otherwise return raw text
    const data: any = ctype.includes('application/json') ? (text ? JSON.parse(text) : null) : text;
    return { data: data as T, idemKey };
  }

  // Should be unreachable, but satisfies TypeScript
  throw lastError ?? new Error('request failed');
}

// -------------------------------
// Quotes
// -------------------------------
export async function createQuote(
  sdk: SDKOptions,
  body: QuoteInput,
  opts: IdemOptions = {}
): Promise<{ quote: QuoteResponse; idempotencyKey: string }> {
  const idem = opts.idempotencyKey ?? (await genIdemKey());
  const { data } = await http<QuoteResponse>(sdk, `/v1/quotes`, {
    method: 'POST',
    body: JSON.stringify(body),
    idem,
  });
  return { quote: data, idempotencyKey: idem };
}

export async function getQuoteByKey(sdk: SDKOptions, key: string): Promise<QuoteResponse> {
  const { data } = await http<QuoteResponse>(sdk, `/v1/quotes/by-key/${encodeURIComponent(key)}`);
  return data;
}

// -------------------------------
// Classify
// -------------------------------
export async function classify(
  sdk: SDKOptions,
  body: ClassifyInput,
  opts: IdemOptions = {}
): Promise<{ result: ClassifyResponse; idempotencyKey: string }> {
  const idem = opts.idempotencyKey ?? (await genIdemKey());
  const { data } = await http<ClassifyResponse>(sdk, `/v1/classify`, {
    method: 'POST',
    body: JSON.stringify(body),
    idem,
  });

  return { result: data, idempotencyKey: idem };
}

// -------------------------------
// Manifests (full set)
// -------------------------------
export async function createManifest(
  sdk: SDKOptions,
  body: ManifestCreateInput,
  opts: IdemOptions = {}
): Promise<{ manifest: ManifestDetail; idempotencyKey: string }> {
  const idem = opts.idempotencyKey ?? (await genIdemKey());
  const { data } = await http<ManifestDetail>(sdk, `/v1/manifests`, {
    method: 'POST',
    body: JSON.stringify(body),
    idem,
  });
  return { manifest: data, idempotencyKey: idem };
}

export async function listManifests(
  sdk: SDKOptions,
  params?: { limit?: number; cursor?: string }
): Promise<ListManifestsResult> {
  const qs: string[] = [];
  if (params?.limit != null) qs.push(`limit=${encodeURIComponent(String(params.limit))}`);
  if (params?.cursor) qs.push(`cursor=${encodeURIComponent(params.cursor)}`);
  const path = `/v1/manifests${qs.length ? `?${qs.join('&')}` : ''}`;
  const { data } = await http<ListManifestsResult>(sdk, path);
  return data;
}

export async function getManifest(sdk: SDKOptions, id: string): Promise<ManifestDetail> {
  const { data } = await http<ManifestDetail>(sdk, `/v1/manifests/${encodeURIComponent(id)}`);
  return data;
}

export async function getManifestFull(sdk: SDKOptions, id: string): Promise<ManifestDetail> {
  const { data } = await http<ManifestDetail>(sdk, `/v1/manifests/${encodeURIComponent(id)}/full`);
  return data;
}

export async function exportManifestItemsCsv(sdk: SDKOptions, id: string): Promise<string> {
  const { data } = await http<string>(sdk, `/v1/manifests/${encodeURIComponent(id)}/items.csv`, {
    // accept is optional here; backend decides content-type
    method: 'GET',
  });
  return data;
}

export async function importManifestItemsCsv(
  sdk: SDKOptions,
  id: string,
  csv: string,
  opts?: { mode?: 'append' | 'replace'; dryRun?: boolean }
): Promise<ManifestItemsImportResponse> {
  const q = new URLSearchParams();
  if (opts?.mode) q.set('mode', opts.mode);
  if (opts?.dryRun != null) q.set('dryRun', String(!!opts.dryRun));
  const path = `/v1/manifests/${encodeURIComponent(id)}/items:import-csv${
    q.toString() ? `?${q.toString()}` : ''
  }`;

  const { data } = await http<ManifestItemsImportResponse>(sdk, path, {
    method: 'POST',
    headers: { 'content-type': 'text/csv' },
    // body must be plain text (CSV)
    body: csv as any,
  });
  return data;
}

export async function computeManifest(
  sdk: SDKOptions,
  id: string,
  allocation: 'chargeable' | 'volumetric' | 'weight',
  opts: { idempotencyKey?: string; dryRun?: boolean } = {}
): Promise<{ result: ManifestComputeResponse; idempotencyKey: string }> {
  const idem = opts.idempotencyKey ?? (await genIdemKey());
  const { data } = await http<ManifestComputeResponse>(
    sdk,
    `/v1/manifests/${encodeURIComponent(id)}/compute`,
    {
      method: 'POST',
      idem,
      body: JSON.stringify({ allocation, dryRun: !!opts.dryRun }),
    }
  );
  return { result: data, idempotencyKey: idem };
}

export async function getManifestQuotes(
  sdk: SDKOptions,
  id: string
): Promise<ManifestQuotesResponse> {
  const { data } = await http<ManifestQuotesResponse>(
    sdk,
    `/v1/manifests/${encodeURIComponent(id)}/quotes`
  );
  return data;
}

export async function getManifestQuotesHistory(
  sdk: SDKOptions,
  id: string
): Promise<ManifestQuotesHistoryResponse> {
  const { data } = await http<ManifestQuotesHistoryResponse>(
    sdk,
    `/v1/manifests/${encodeURIComponent(id)}/quotes/history`
  );
  return data;
}

export async function cloneManifest(
  sdk: SDKOptions,
  id: string,
  name?: string
): Promise<ManifestDetail> {
  const { data } = await http<ManifestDetail>(
    sdk,
    `/v1/manifests/${encodeURIComponent(id)}/clone`,
    {
      method: 'POST',
      body: JSON.stringify(name ? { name } : {}),
    }
  );
  return data;
}

export async function deleteManifest(sdk: SDKOptions, id: string): Promise<{ ok: true }> {
  const { data } = await http<{ ok: true }>(sdk, `/v1/manifests/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return data;
}
