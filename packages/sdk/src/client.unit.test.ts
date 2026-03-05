import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  genIdemKey,
  createQuote,
  getQuoteByKey,
  classify,
  createManifest,
  listManifests,
  getManifest,
  getManifestFull,
  exportManifestItemsCsv,
  importManifestItemsCsv,
  computeManifest,
  getManifestQuotes,
  getManifestQuotesHistory,
  cloneManifest,
  deleteManifest,
  _setSleep,
} from './client.js';
import type { SDKOptions } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** No-op sleep so retry tests run instantly */
let originalSleep: (ms: number) => Promise<void>;
beforeEach(() => {
  originalSleep = _setSleep(async () => {});
});
afterEach(() => {
  _setSleep(originalSleep);
});

function mockFetch(body: unknown, status = 200, headers?: Record<string, string>) {
  const h = new Headers({ 'content-type': 'application/json', ...headers });
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: h,
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  });
}

function sdk(fetchFn: ReturnType<typeof mockFetch>, opts?: Partial<SDKOptions>): SDKOptions {
  return {
    baseUrl: 'https://api.test.dev',
    apiKey: 'ck_test_key.secret',
    fetch: fetchFn as unknown as typeof fetch,
    retry: false, // disable retries by default in tests for deterministic behavior
    ...opts,
  };
}

function lastCall(fetchFn: ReturnType<typeof mockFetch>) {
  return {
    url: fetchFn.mock.calls[0]![0] as string,
    init: fetchFn.mock.calls[0]![1] as RequestInit & { headers: Record<string, string> },
  };
}

// ---------------------------------------------------------------------------
// genIdemKey
// ---------------------------------------------------------------------------

describe('genIdemKey', () => {
  it('returns a string with ck_idem_ prefix', async () => {
    const key = await genIdemKey();
    expect(key).toMatch(/^ck_idem_[A-Za-z0-9_-]+$/);
  });

  it('generates unique keys', async () => {
    const keys = await Promise.all(Array.from({ length: 10 }, () => genIdemKey()));
    expect(new Set(keys).size).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

const quoteInput = {
  origin: 'US',
  dest: 'DE',
  itemValue: { amount: 100, currency: 'USD' },
  dimsCm: { l: 20, w: 15, h: 10 },
  weightKg: 1.2,
  categoryKey: 'general',
  mode: 'air' as const,
};

const sampleQuote = {
  hs6: '850440',
  chargeableKg: 1.2,
  freight: { amount: 10, currency: 'EUR' },
  total: { amount: 130, currency: 'EUR' },
  guaranteedMax: { amount: 140, currency: 'EUR' },
  policy: 'ddp',
  components: { CIF: 110, duty: 5, vat: 15, fees: 0 },
  deMinimis: { suppressDuty: false, suppressVAT: false },
  componentConfidence: {
    duty: 'authoritative',
    vat: 'authoritative',
    surcharges: 'estimated',
    freight: 'authoritative',
    fx: 'authoritative',
  },
};

describe('createQuote', () => {
  it('sends POST to /v1/quotes with correct headers and body', async () => {
    const f = mockFetch(sampleQuote, 200, { 'Idempotency-Key': 'ck_idem_abc' });
    const result = await createQuote(sdk(f), quoteInput, { idempotencyKey: 'ck_idem_custom' });

    const { url, init } = lastCall(f);
    expect(url).toBe('https://api.test.dev/v1/quotes');
    expect(init.method).toBe('POST');
    expect(init.headers['authorization']).toBe('Bearer ck_test_key.secret');
    expect(init.headers['content-type']).toBe('application/json');
    expect(init.headers['Idempotency-Key']).toBe('ck_idem_custom');
    expect(JSON.parse(init.body as string)).toEqual(quoteInput);
    expect(result.quote).toEqual(sampleQuote);
    expect(result.idempotencyKey).toBe('ck_idem_custom');
  });

  it('auto-generates idempotency key when not provided', async () => {
    const f = mockFetch(sampleQuote);
    const result = await createQuote(sdk(f), quoteInput);
    expect(result.idempotencyKey).toMatch(/^ck_idem_/);
  });
});

describe('getQuoteByKey', () => {
  it('sends GET to /v1/quotes/by-key/:key', async () => {
    const f = mockFetch(sampleQuote);
    const result = await getQuoteByKey(sdk(f), 'my-key');
    expect(lastCall(f).url).toBe('https://api.test.dev/v1/quotes/by-key/my-key');
    expect(result).toEqual(sampleQuote);
  });

  it('encodes special characters in key', async () => {
    const f = mockFetch(sampleQuote);
    await getQuoteByKey(sdk(f), 'key/with spaces');
    expect(lastCall(f).url).toBe('https://api.test.dev/v1/quotes/by-key/key%2Fwith%20spaces');
  });
});

// ---------------------------------------------------------------------------
// Classify
// ---------------------------------------------------------------------------

const classifyInput = { title: 'USB-C charger', categoryKey: 'electronics' };
const classifyResponse = { hs6: '850440', confidence: 0.95, candidates: [] };

describe('classify', () => {
  it('sends POST to /v1/classify', async () => {
    const f = mockFetch(classifyResponse);
    const result = await classify(sdk(f), classifyInput, { idempotencyKey: 'ck_idem_cls' });

    const { url, init } = lastCall(f);
    expect(url).toBe('https://api.test.dev/v1/classify');
    expect(init.method).toBe('POST');
    expect(result.result).toEqual(classifyResponse);
    expect(result.idempotencyKey).toBe('ck_idem_cls');
  });
});

// ---------------------------------------------------------------------------
// Manifests
// ---------------------------------------------------------------------------

const manifestDetail = { id: '00000000-0000-0000-0000-000000000001', name: 'Test', mode: 'air' };

describe('createManifest', () => {
  it('sends POST to /v1/manifests', async () => {
    const f = mockFetch(manifestDetail);
    const result = await createManifest(sdk(f), { name: 'Test', mode: 'air', items: [] });

    expect(lastCall(f).url).toBe('https://api.test.dev/v1/manifests');
    expect(lastCall(f).init.method).toBe('POST');
    expect(result.manifest).toEqual(manifestDetail);
  });
});

describe('listManifests', () => {
  it('sends GET to /v1/manifests with pagination params', async () => {
    const listResult = { rows: [manifestDetail], nextCursor: 'abc' };
    const f = mockFetch(listResult);
    const result = await listManifests(sdk(f), { limit: 10, cursor: 'xyz' });

    expect(lastCall(f).url).toBe('https://api.test.dev/v1/manifests?limit=10&cursor=xyz');
    expect(result).toEqual(listResult);
  });

  it('sends GET without query params when none provided', async () => {
    const f = mockFetch({ rows: [] });
    await listManifests(sdk(f));
    expect(lastCall(f).url).toBe('https://api.test.dev/v1/manifests');
  });
});

describe('getManifest', () => {
  it('sends GET to /v1/manifests/:id', async () => {
    const f = mockFetch(manifestDetail);
    const result = await getManifest(sdk(f), 'abc-123');
    expect(lastCall(f).url).toBe('https://api.test.dev/v1/manifests/abc-123');
    expect(result).toEqual(manifestDetail);
  });
});

describe('getManifestFull', () => {
  it('sends GET to /v1/manifests/:id/full', async () => {
    const f = mockFetch(manifestDetail);
    await getManifestFull(sdk(f), 'abc-123');
    expect(lastCall(f).url).toBe('https://api.test.dev/v1/manifests/abc-123/full');
  });
});

describe('exportManifestItemsCsv', () => {
  it('returns raw CSV text', async () => {
    const csv = 'hs6,weight\n850440,1.2';
    const h = new Headers({ 'content-type': 'text/csv' });
    const f = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: h,
      text: () => Promise.resolve(csv),
    });
    const result = await exportManifestItemsCsv(sdk(f), 'abc-123');
    expect(lastCall(f).url).toBe('https://api.test.dev/v1/manifests/abc-123/items.csv');
    expect(result).toBe(csv);
  });
});

describe('importManifestItemsCsv', () => {
  it('sends POST with text/csv content type', async () => {
    const importResp = {
      mode: 'append',
      dryRun: false,
      valid: 2,
      invalid: 0,
      inserted: 2,
      errors: [],
    };
    const f = mockFetch(importResp);
    const result = await importManifestItemsCsv(sdk(f), 'abc-123', 'hs6,weight\n850440,1.2', {
      mode: 'append',
      dryRun: true,
    });

    const { url, init } = lastCall(f);
    expect(url).toBe(
      'https://api.test.dev/v1/manifests/abc-123/items:import-csv?mode=append&dryRun=true'
    );
    expect(init.method).toBe('POST');
    expect(init.headers['content-type']).toBe('text/csv');
    expect(result).toEqual(importResp);
  });
});

describe('computeManifest', () => {
  it('sends POST with allocation and dryRun', async () => {
    const computeResp = {
      ok: true,
      manifestId: 'abc-123',
      allocation: 'chargeable',
      dryRun: false,
      summary: null,
      items: [],
    };
    const f = mockFetch(computeResp);
    const result = await computeManifest(sdk(f), 'abc-123', 'chargeable', {
      idempotencyKey: 'ck_idem_comp',
    });

    const { url, init } = lastCall(f);
    expect(url).toBe('https://api.test.dev/v1/manifests/abc-123/compute');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ allocation: 'chargeable', dryRun: false });
    expect(result.result).toEqual(computeResp);
    expect(result.idempotencyKey).toBe('ck_idem_comp');
  });
});

describe('getManifestQuotes', () => {
  it('sends GET to /v1/manifests/:id/quotes', async () => {
    const quotesResp = { ok: true, manifestId: 'abc-123', summary: null, items: [] };
    const f = mockFetch(quotesResp);
    const result = await getManifestQuotes(sdk(f), 'abc-123');

    expect(lastCall(f).url).toBe('https://api.test.dev/v1/manifests/abc-123/quotes');
    expect(result).toEqual(quotesResp);
  });
});

describe('getManifestQuotesHistory', () => {
  it('sends GET to /v1/manifests/:id/quotes/history', async () => {
    const historyResp = { items: [] };
    const f = mockFetch(historyResp);
    const result = await getManifestQuotesHistory(sdk(f), 'abc-123');

    expect(lastCall(f).url).toBe('https://api.test.dev/v1/manifests/abc-123/quotes/history');
    expect(result).toEqual(historyResp);
  });
});

describe('cloneManifest', () => {
  it('sends POST to /v1/manifests/:id/clone', async () => {
    const f = mockFetch(manifestDetail);
    const result = await cloneManifest(sdk(f), 'abc-123', 'Cloned');

    const { url, init } = lastCall(f);
    expect(url).toBe('https://api.test.dev/v1/manifests/abc-123/clone');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Cloned' });
    expect(result).toEqual(manifestDetail);
  });

  it('sends empty body when no name provided', async () => {
    const f = mockFetch(manifestDetail);
    await cloneManifest(sdk(f), 'abc-123');
    expect(JSON.parse(lastCall(f).init.body as string)).toEqual({});
  });
});

describe('deleteManifest', () => {
  it('sends DELETE to /v1/manifests/:id', async () => {
    const f = mockFetch({ ok: true });
    const result = await deleteManifest(sdk(f), 'abc-123');

    expect(lastCall(f).url).toBe('https://api.test.dev/v1/manifests/abc-123');
    expect(lastCall(f).init.method).toBe('DELETE');
    expect(result).toEqual({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('error handling', () => {
  it('throws on non-2xx with JSON body', async () => {
    const f = mockFetch({ error: { message: 'Rate limit exceeded' } }, 429);
    await expect(createQuote(sdk(f), quoteInput)).rejects.toThrow('429');
  });

  it('throws on non-2xx with plain text', async () => {
    const h = new Headers({ 'content-type': 'text/plain' });
    const f = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: h,
      text: () => Promise.resolve('Internal Server Error'),
    });
    await expect(createQuote(sdk(f), quoteInput)).rejects.toThrow('500 Internal Server Error');
  });

  it('throws when baseUrl is missing', async () => {
    const f = mockFetch({});
    await expect(
      createQuote({ baseUrl: '', apiKey: 'key', fetch: f as unknown as typeof fetch }, quoteInput)
    ).rejects.toThrow('SDK baseUrl is required');
  });

  it('throws when apiKey is missing', async () => {
    const f = mockFetch({});
    await expect(
      createQuote(
        { baseUrl: 'https://api.test.dev', apiKey: '', fetch: f as unknown as typeof fetch },
        quoteInput
      )
    ).rejects.toThrow('SDK apiKey is required');
  });
});

// ---------------------------------------------------------------------------
// Retry / backoff
// ---------------------------------------------------------------------------

function mockFetchSequence(
  responses: Array<{ body: unknown; status: number; headers?: Record<string, string> }>
) {
  let callIdx = 0;
  return vi.fn().mockImplementation(async () => {
    const r = responses[Math.min(callIdx++, responses.length - 1)]!;
    const h = new Headers({ 'content-type': 'application/json', ...r.headers });
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      headers: h,
      text: () => Promise.resolve(typeof r.body === 'string' ? r.body : JSON.stringify(r.body)),
    };
  });
}

describe('retry / backoff', () => {
  it('retries on 429 and succeeds on subsequent attempt', async () => {
    const f = mockFetchSequence([
      { body: { error: 'Rate limited' }, status: 429 },
      { body: sampleQuote, status: 200 },
    ]);

    const result = await createQuote(sdk(f, { retry: { maxRetries: 2 } }), quoteInput);

    expect(f).toHaveBeenCalledTimes(2);
    expect(result.quote).toEqual(sampleQuote);
  });

  it('retries on 500 and succeeds', async () => {
    const f = mockFetchSequence([
      { body: 'Internal error', status: 500 },
      { body: 'Internal error', status: 502 },
      { body: sampleQuote, status: 200 },
    ]);

    const result = await createQuote(sdk(f, { retry: { maxRetries: 3 } }), quoteInput);

    expect(f).toHaveBeenCalledTimes(3);
    expect(result.quote).toEqual(sampleQuote);
  });

  it('throws after exhausting all retries', async () => {
    const f = mockFetchSequence([
      { body: { error: 'Rate limited' }, status: 429 },
      { body: { error: 'Rate limited' }, status: 429 },
      { body: { error: 'Rate limited' }, status: 429 },
    ]);

    await expect(createQuote(sdk(f, { retry: { maxRetries: 2 } }), quoteInput)).rejects.toThrow(
      '429'
    );

    // initial + 2 retries = 3 total
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('does not retry on 4xx errors other than 429', async () => {
    const f = mockFetchSequence([{ body: { error: 'Bad request' }, status: 400 }]);

    await expect(createQuote(sdk(f, { retry: { maxRetries: 3 } }), quoteInput)).rejects.toThrow(
      '400'
    );

    expect(f).toHaveBeenCalledTimes(1);
  });

  it('does not retry when retry is set to false', async () => {
    const f = mockFetchSequence([{ body: { error: 'Server error' }, status: 500 }]);

    await expect(createQuote(sdk(f, { retry: false }), quoteInput)).rejects.toThrow('500');

    expect(f).toHaveBeenCalledTimes(1);
  });

  it('retries on network errors (fetch throws)', async () => {
    let callIdx = 0;
    const f = vi.fn().mockImplementation(async () => {
      callIdx++;
      if (callIdx <= 2) throw new Error('ECONNREFUSED');
      const h = new Headers({ 'content-type': 'application/json' });
      return {
        ok: true,
        status: 200,
        headers: h,
        text: () => Promise.resolve(JSON.stringify(sampleQuote)),
      };
    });

    const result = await createQuote(sdk(f, { retry: { maxRetries: 3 } }), quoteInput);

    expect(f).toHaveBeenCalledTimes(3);
    expect(result.quote).toEqual(sampleQuote);
  });

  it('throws network error after exhausting retries', async () => {
    const f = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(createQuote(sdk(f, { retry: { maxRetries: 1 } }), quoteInput)).rejects.toThrow(
      'ECONNREFUSED'
    );

    // initial + 1 retry = 2 total
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('honours Retry-After header (seconds)', async () => {
    const sleepCalls: number[] = [];
    _setSleep(async (ms) => {
      sleepCalls.push(ms);
    });

    const f = mockFetchSequence([
      { body: { error: 'Rate limited' }, status: 429, headers: { 'retry-after': '2' } },
      { body: sampleQuote, status: 200 },
    ]);

    await createQuote(sdk(f, { retry: { maxRetries: 1 } }), quoteInput);

    // Should have slept for the backoff delay + the Retry-After clamped delay
    expect(sleepCalls.length).toBeGreaterThanOrEqual(1);
    // The Retry-After sleep should be 2000ms (2 seconds)
    expect(sleepCalls.some((ms) => ms === 2000)).toBe(true);
  });

  it('respects custom retryableStatuses', async () => {
    const f = mockFetchSequence([
      { body: { error: 'Teapot' }, status: 418 },
      { body: sampleQuote, status: 200 },
    ]);

    const result = await createQuote(
      sdk(f, { retry: { maxRetries: 1, retryableStatuses: [418] } }),
      quoteInput
    );

    expect(f).toHaveBeenCalledTimes(2);
    expect(result.quote).toEqual(sampleQuote);
  });

  it('calls sleep with delays from backoff strategy', async () => {
    const sleepCalls: number[] = [];
    _setSleep(async (ms) => {
      sleepCalls.push(ms);
    });

    const f = mockFetchSequence([
      { body: { error: 'err' }, status: 503 },
      { body: { error: 'err' }, status: 503 },
      { body: sampleQuote, status: 200 },
    ]);

    await createQuote(
      sdk(f, { retry: { maxRetries: 2, initialDelayMs: 100, maxDelayMs: 5000 } }),
      quoteInput
    );

    // Two retries → two backoff sleeps
    expect(sleepCalls.length).toBe(2);
    // Backoff with jitter: delays should be within bounds
    expect(sleepCalls[0]!).toBeLessThanOrEqual(100); // attempt 0: max = min(5000, 100 * 2^0) = 100
    expect(sleepCalls[1]!).toBeLessThanOrEqual(200); // attempt 1: max = min(5000, 100 * 2^1) = 200
  });
});
