import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpFetch } from '../http.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('httpFetch', () => {
  it('retries idempotent requests on retryable status codes', async () => {
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return new Response('retry', { status: 503 });
      return new Response('ok', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await httpFetch('https://example.com', { retryDelayMs: () => 0 });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-idempotent requests by default', async () => {
    const fetchMock = vi.fn(async () => new Response('retry', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await httpFetch('https://example.com', {
      method: 'POST',
      retryDelayMs: () => 0,
    });
    expect(res.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('supports opt-in retries for non-idempotent requests', async () => {
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error('temporary');
      return new Response('ok', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await httpFetch('https://example.com', {
      method: 'POST',
      retries: 1,
      retryDelayMs: () => 0,
    });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('honors custom retryOn predicate', async () => {
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls += 1;
      return new Response(calls === 1 ? 'retry' : 'ok', { status: calls === 1 ? 500 : 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await httpFetch('https://example.com', {
      retries: 1,
      retryOn: (r) => r.status === 500,
      retryDelayMs: () => 0,
    });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('aborts timed-out requests', async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      httpFetch('https://example.com', { timeoutMs: 5, retries: 0, retryDelayMs: () => 0 })
    ).rejects.toThrow('aborted');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('merges external abort signal with internal timeout signal', async () => {
    const controller = new AbortController();
    controller.abort();

    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new Error('externally aborted');
      return Promise.resolve(new Response('ok'));
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      httpFetch('https://example.com', {
        signal: controller.signal,
        retries: 0,
        retryDelayMs: () => 0,
      })
    ).rejects.toThrow('externally aborted');
  });

  it('uses manual merge fallback when AbortSignal.any is unavailable', async () => {
    const originalAny = (AbortSignal as any).any;
    Object.defineProperty(AbortSignal, 'any', { value: undefined, configurable: true });
    try {
      const external = new AbortController();
      const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('merged-abort')), {
            once: true,
          });
        });
      });
      vi.stubGlobal('fetch', fetchMock);

      const req = httpFetch('https://example.com', {
        signal: external.signal,
        timeoutMs: 10_000,
        retries: 0,
        retryDelayMs: () => 0,
      });
      external.abort();
      await expect(req).rejects.toThrow('merged-abort');
    } finally {
      if (originalAny !== undefined) {
        Object.defineProperty(AbortSignal, 'any', { value: originalAny, configurable: true });
      } else {
        delete (AbortSignal as any).any;
      }
    }
  });
});
