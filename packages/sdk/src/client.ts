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

/**
 * Generates a unique idempotency key prefixed with `ck_idem_`.
 *
 * Uses `crypto.getRandomValues` when available (browser / Node 19+),
 * falling back to `Math.random` otherwise. The resulting key is a
 * URL-safe Base64 string suitable for use as an `Idempotency-Key` header.
 *
 * @returns A unique idempotency key string in the format `ck_idem_<base64url>`.
 *
 * @example
 * ```ts
 * const key = await genIdemKey();
 * // => "ck_idem_dGhpcyBpcyBhIHRlc3Q"
 * ```
 */
export async function genIdemKey(): Promise<string> {
  const g = globalThis as unknown as { crypto?: Crypto; btoa?: (s: string) => string };
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
    } catch (err: unknown) {
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
      } catch (e: unknown) {
        if (e instanceof Error && e.message.startsWith(`${res.status} `)) throw e;
        throw new Error(`${res.status} ${text || 'request failed'}`);
      }
    }

    // Parse JSON when possible, otherwise return raw text
    const data = ctype.includes('application/json') ? (text ? JSON.parse(text) : null) : text;
    return { data: data as T, idemKey };
  }

  // Should be unreachable, but satisfies TypeScript
  throw lastError ?? new Error('request failed');
}

// -------------------------------
// Quotes
// -------------------------------

/**
 * Creates a landed-cost quote for a single item shipment.
 *
 * Sends a `POST /v1/quotes` request with the provided quote input. An
 * idempotency key is attached automatically (or you can supply your own)
 * to ensure the same quote is not created twice on retries.
 *
 * @param sdk - SDK configuration containing `baseUrl`, `apiKey`, and optional retry/fetch settings.
 * @param body - The quote input describing the shipment (origin, destination, item value, dimensions, weight, category, and shipping mode).
 * @param opts - Optional idempotency options. If `idempotencyKey` is omitted, one is generated automatically.
 * @returns An object containing the computed {@link QuoteResponse} and the `idempotencyKey` used.
 *
 * @example
 * ```ts
 * const { quote, idempotencyKey } = await createQuote(sdk, {
 *   origin: 'CN',
 *   dest: 'US',
 *   itemValue: { amount: 49.99, currency: 'USD' },
 *   dimsCm: { l: 30, w: 20, h: 10 },
 *   weightKg: 1.5,
 *   categoryKey: 'electronics',
 *   mode: 'air',
 * });
 * ```
 */
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

/**
 * Retrieves a previously created quote by its idempotency key.
 *
 * Sends a `GET /v1/quotes/by-key/:key` request. This is useful for
 * looking up the result of a quote that was created earlier without
 * needing to store the full response.
 *
 * @param sdk - SDK configuration containing `baseUrl`, `apiKey`, and optional retry/fetch settings.
 * @param key - The idempotency key that was used (or generated) when the quote was created.
 * @returns The {@link QuoteResponse} associated with the given key.
 *
 * @example
 * ```ts
 * const quote = await getQuoteByKey(sdk, 'ck_idem_dGhpcyBpcyBhIHRlc3Q');
 * console.log(quote.total);
 * ```
 */
export async function getQuoteByKey(sdk: SDKOptions, key: string): Promise<QuoteResponse> {
  const { data } = await http<QuoteResponse>(sdk, `/v1/quotes/by-key/${encodeURIComponent(key)}`);
  return data;
}

// -------------------------------
// Classify
// -------------------------------

/**
 * Classifies a product and returns its predicted HS6 code.
 *
 * Sends a `POST /v1/classify` request. The classification engine uses
 * the product title (and optionally a description, category key, and
 * origin country) to predict the most likely 6-digit HS code along
 * with a confidence score and alternative candidates.
 *
 * @param sdk - SDK configuration containing `baseUrl`, `apiKey`, and optional retry/fetch settings.
 * @param body - The classification input with at minimum a `title`. Optionally includes `description`, `categoryKey`, and `origin` (ISO 3166-1 alpha-2).
 * @param opts - Optional idempotency options. If `idempotencyKey` is omitted, one is generated automatically.
 * @returns An object containing the {@link ClassifyResponse} (with `hs6`, `confidence`, and optional `candidates`) and the `idempotencyKey` used.
 *
 * @example
 * ```ts
 * const { result } = await classify(sdk, {
 *   title: 'Wireless Bluetooth Headphones',
 *   description: 'Over-ear noise-cancelling headphones',
 *   origin: 'CN',
 * });
 * console.log(result.hs6);        // e.g. "851830"
 * console.log(result.confidence); // e.g. 0.92
 * ```
 */
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

/**
 * Creates a new manifest containing one or more line items for bulk landed-cost computation.
 *
 * Sends a `POST /v1/manifests` request. A manifest groups multiple items that
 * will be shipped together so their landed costs can be computed as a batch
 * with shared freight allocation.
 *
 * @param sdk - SDK configuration containing `baseUrl`, `apiKey`, and optional retry/fetch settings.
 * @param body - The manifest creation input including `mode` (`'air'` or `'sea'`), an array of `items`, and an optional `name`.
 * @param opts - Optional idempotency options. If `idempotencyKey` is omitted, one is generated automatically.
 * @returns An object containing the created {@link ManifestDetail} and the `idempotencyKey` used.
 *
 * @example
 * ```ts
 * const { manifest } = await createManifest(sdk, {
 *   name: 'Spring Order Batch',
 *   mode: 'air',
 *   items: [
 *     {
 *       origin: 'CN',
 *       dest: 'US',
 *       itemValue: { amount: 25, currency: 'USD' },
 *       dimsCm: { l: 20, w: 15, h: 10 },
 *       weightKg: 0.5,
 *       categoryKey: 'apparel',
 *     },
 *   ],
 * });
 * console.log(manifest.id); // UUID of the new manifest
 * ```
 */
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

/**
 * Lists manifests for the authenticated tenant with cursor-based pagination.
 *
 * Sends a `GET /v1/manifests` request. Results are returned as an array
 * of manifest summaries with a `nextCursor` value for fetching subsequent pages.
 *
 * @param sdk - SDK configuration containing `baseUrl`, `apiKey`, and optional retry/fetch settings.
 * @param params - Optional pagination parameters.
 * @param params.limit - Maximum number of manifests to return per page.
 * @param params.cursor - Opaque cursor string from a previous response's `nextCursor` to fetch the next page.
 * @returns A {@link ListManifestsResult} containing `rows` (array of manifest summaries) and an optional `nextCursor`.
 *
 * @example
 * ```ts
 * // Fetch the first page
 * const page1 = await listManifests(sdk, { limit: 10 });
 * console.log(page1.rows);
 *
 * // Fetch the next page if available
 * if (page1.nextCursor) {
 *   const page2 = await listManifests(sdk, { limit: 10, cursor: page1.nextCursor });
 * }
 * ```
 */
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

/**
 * Retrieves a manifest by its ID.
 *
 * Sends a `GET /v1/manifests/:id` request. Returns the manifest summary
 * along with its items, but without fully expanded quote data. Use
 * {@link getManifestFull} if you also need the computed totals and quote details.
 *
 * @param sdk - SDK configuration containing `baseUrl`, `apiKey`, and optional retry/fetch settings.
 * @param id - The UUID of the manifest to retrieve.
 * @returns The {@link ManifestDetail} for the requested manifest.
 *
 * @example
 * ```ts
 * const manifest = await getManifest(sdk, '5f8a1c2d-...');
 * console.log(manifest.name, manifest.status);
 * ```
 */
export async function getManifest(sdk: SDKOptions, id: string): Promise<ManifestDetail> {
  const { data } = await http<ManifestDetail>(sdk, `/v1/manifests/${encodeURIComponent(id)}`);
  return data;
}

/**
 * Retrieves a manifest by its ID with fully expanded details.
 *
 * Sends a `GET /v1/manifests/:id/full` request. Unlike {@link getManifest},
 * this endpoint includes the complete computed totals, quote breakdown,
 * and all nested item data.
 *
 * @param sdk - SDK configuration containing `baseUrl`, `apiKey`, and optional retry/fetch settings.
 * @param id - The UUID of the manifest to retrieve.
 * @returns The fully expanded {@link ManifestDetail} including totals and quote data.
 *
 * @example
 * ```ts
 * const full = await getManifestFull(sdk, '5f8a1c2d-...');
 * console.log(full.totals, full.quote);
 * ```
 */
export async function getManifestFull(sdk: SDKOptions, id: string): Promise<ManifestDetail> {
  const { data } = await http<ManifestDetail>(sdk, `/v1/manifests/${encodeURIComponent(id)}/full`);
  return data;
}

/**
 * Exports the items of a manifest as a CSV string.
 *
 * Sends a `GET /v1/manifests/:id/items.csv` request. The returned string
 * contains a header row followed by one row per manifest item, suitable
 * for saving to a `.csv` file or further processing.
 *
 * @param sdk - SDK configuration containing `baseUrl`, `apiKey`, and optional retry/fetch settings.
 * @param id - The UUID of the manifest whose items should be exported.
 * @returns The manifest items formatted as a CSV string.
 *
 * @example
 * ```ts
 * const csv = await exportManifestItemsCsv(sdk, '5f8a1c2d-...');
 * fs.writeFileSync('manifest-items.csv', csv);
 * ```
 */
export async function exportManifestItemsCsv(sdk: SDKOptions, id: string): Promise<string> {
  const { data } = await http<string>(sdk, `/v1/manifests/${encodeURIComponent(id)}/items.csv`, {
    // accept is optional here; backend decides content-type
    method: 'GET',
  });
  return data;
}

/**
 * Imports manifest items from a CSV string.
 *
 * Sends a `POST /v1/manifests/:id/items:import-csv` request with the CSV
 * body. Items can either be appended to the existing manifest items or
 * replace them entirely. A dry-run mode is available to validate the CSV
 * without persisting changes.
 *
 * @param sdk - SDK configuration containing `baseUrl`, `apiKey`, and optional retry/fetch settings.
 * @param id - The UUID of the manifest to import items into.
 * @param csv - The CSV string to import. Must include a header row matching the expected column format.
 * @param opts - Optional import settings.
 * @param opts.mode - Whether to `'append'` new items (default) or `'replace'` all existing items.
 * @param opts.dryRun - When `true`, validates the CSV and returns results without persisting changes.
 * @returns A {@link ManifestItemsImportResponse} with counts of `valid`, `invalid`, `inserted`, and optionally `replaced` rows, plus any row-level `errors`.
 *
 * @example
 * ```ts
 * const csv = 'origin,dest,weightKg,...\nCN,US,1.5,...';
 *
 * // Validate first with a dry run
 * const dryResult = await importManifestItemsCsv(sdk, manifestId, csv, {
 *   mode: 'append',
 *   dryRun: true,
 * });
 *
 * if (dryResult.invalid === 0) {
 *   // Commit the import
 *   await importManifestItemsCsv(sdk, manifestId, csv, { mode: 'append' });
 * }
 * ```
 */
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
    body: csv,
  });
  return data;
}

/**
 * Computes landed costs for all items in a manifest.
 *
 * Sends a `POST /v1/manifests/:id/compute` request. The compute step
 * calculates duty, VAT, freight, and fees for every item in the manifest
 * using the specified freight allocation strategy. A dry-run mode is
 * available to preview results without persisting a quote snapshot.
 *
 * @param sdk - SDK configuration containing `baseUrl`, `apiKey`, and optional retry/fetch settings.
 * @param id - The UUID of the manifest to compute.
 * @param allocation - The freight allocation strategy:
 *   - `'chargeable'` -- allocate freight by chargeable weight (max of actual vs. volumetric).
 *   - `'volumetric'` -- allocate freight by volumetric weight only.
 *   - `'weight'` -- allocate freight by actual weight only.
 * @param opts - Optional settings.
 * @param opts.idempotencyKey - A custom idempotency key. If omitted, one is generated automatically.
 * @param opts.dryRun - When `true`, computes results without persisting a quote snapshot.
 * @returns An object containing the {@link ManifestComputeResponse} (with per-item quotes and a summary) and the `idempotencyKey` used.
 *
 * @example
 * ```ts
 * const { result } = await computeManifest(sdk, manifestId, 'chargeable');
 * console.log(result.summary);  // aggregate totals
 * console.log(result.items);    // per-item quote breakdown
 * ```
 */
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

/**
 * Retrieves the latest computed quotes for a manifest.
 *
 * Sends a `GET /v1/manifests/:id/quotes` request. Returns the most recent
 * quote snapshot including a summary and per-item quote breakdown. The
 * manifest must have been computed at least once via {@link computeManifest}
 * before quotes are available.
 *
 * @param sdk - SDK configuration containing `baseUrl`, `apiKey`, and optional retry/fetch settings.
 * @param id - The UUID of the manifest to retrieve quotes for.
 * @returns A {@link ManifestQuotesResponse} with `summary` and `items` arrays.
 *
 * @example
 * ```ts
 * const quotes = await getManifestQuotes(sdk, manifestId);
 * console.log(quotes.summary); // aggregate totals
 * quotes.items.forEach((item) => console.log(item));
 * ```
 */
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

/**
 * Retrieves the full computation history for a manifest.
 *
 * Sends a `GET /v1/manifests/:id/quotes/history` request. Returns a list
 * of all previous compute runs for the manifest, including their
 * idempotency keys, allocation strategies, timestamps, and whether they
 * were dry runs.
 *
 * @param sdk - SDK configuration containing `baseUrl`, `apiKey`, and optional retry/fetch settings.
 * @param id - The UUID of the manifest to retrieve quote history for.
 * @returns A {@link ManifestQuotesHistoryResponse} containing an `items` array of historical compute entries.
 *
 * @example
 * ```ts
 * const history = await getManifestQuotesHistory(sdk, manifestId);
 * history.items.forEach((entry) => {
 *   console.log(entry.createdAt, entry.allocation, entry.dryRun);
 * });
 * ```
 */
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

/**
 * Clones an existing manifest, creating a deep copy with new IDs.
 *
 * Sends a `POST /v1/manifests/:id/clone` request. The cloned manifest
 * contains the same items and configuration as the original but is
 * assigned a new UUID. An optional `name` can be provided; otherwise
 * the server assigns a default name.
 *
 * @param sdk - SDK configuration containing `baseUrl`, `apiKey`, and optional retry/fetch settings.
 * @param id - The UUID of the manifest to clone.
 * @param name - Optional name for the cloned manifest.
 * @returns The newly created {@link ManifestDetail} for the clone.
 *
 * @example
 * ```ts
 * const clone = await cloneManifest(sdk, originalManifestId, 'Copy of Spring Batch');
 * console.log(clone.id); // new UUID
 * ```
 */
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

/**
 * Deletes a manifest and all of its associated items and quotes.
 *
 * Sends a `DELETE /v1/manifests/:id` request. This operation is
 * irreversible -- the manifest and all related data are permanently removed.
 *
 * @param sdk - SDK configuration containing `baseUrl`, `apiKey`, and optional retry/fetch settings.
 * @param id - The UUID of the manifest to delete.
 * @returns An object with `{ ok: true }` confirming the deletion.
 *
 * @example
 * ```ts
 * await deleteManifest(sdk, '5f8a1c2d-...');
 * ```
 */
export async function deleteManifest(sdk: SDKOptions, id: string): Promise<{ ok: true }> {
  const { data } = await http<{ ok: true }>(sdk, `/v1/manifests/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return data;
}
