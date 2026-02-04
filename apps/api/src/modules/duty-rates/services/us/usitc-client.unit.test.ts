import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsitcClient } from './usitc-client.js';

const { state } = vi.hoisted(() => ({
  state: {
    queue: [] as Array<Response | Error>,
    calls: [] as Array<{ url: string; init?: RequestInit }>,
  },
}));

vi.mock('../../../../lib/http.js', () => ({
  httpFetch: vi.fn(async (url: string, init?: RequestInit) => {
    state.calls.push({ url, init });
    const next = state.queue.shift();
    if (!next) throw new Error('No queued response for httpFetch');
    if (next instanceof Error) throw next;
    return next;
  }),
}));

vi.mock('../../../surcharges/services/llm/import-cross-check.js', () => ({
  hostIsOrSub: (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`),
}));

function resp(body: string, status = 200, headers?: Record<string, string>) {
  return new Response(body, { status, headers });
}

describe('UsitcClient', () => {
  beforeEach(() => {
    state.queue = [];
    state.calls = [];
  });

  it('warms cookies and sends scoped cookie for matching host/path', async () => {
    state.queue.push(
      resp('<html>warm</html>', 200, { 'set-cookie': 'root=1; Domain=www.usitc.gov; Path=/' }),
      resp('<html>warm</html>', 200, { 'set-cookie': 'hts=2; Domain=hts.usitc.gov; Path=/' }),
      resp('<html>warm</html>'),
      resp('{"ok":true}')
    );

    const c = new UsitcClient();
    await c.warm();
    const body = await c.getText('/api/export/data');

    expect(body).toBe('{"ok":true}');
    const lastCall = state.calls.at(-1);
    const headers = (lastCall?.init?.headers ?? {}) as Record<string, string>;
    expect(headers.Cookie).toContain('hts=2');
    expect(headers.Cookie).not.toContain('root=1');
  });

  it('re-warms once when it receives an HTML shell and retries same mode', async () => {
    state.queue.push(
      resp('<html>shell</html>'),
      resp('<html>warm1</html>'),
      resp('<html>warm2</html>'),
      resp('<html>warm3</html>'),
      resp('{"value":1}')
    );

    const c = new UsitcClient();
    const body = await c.getText('/api/data');

    expect(body).toBe('{"value":1}');
    expect(state.calls).toHaveLength(5);
  });

  it('tries next header mode when html persists after re-warm', async () => {
    state.queue.push(
      resp('<html>shell-1</html>'),
      resp('<html>warm1</html>'),
      resp('<html>warm2</html>'),
      resp('<html>warm3</html>'),
      resp('<html>still-shell</html>'),
      resp('{"ok":2}')
    );

    const c = new UsitcClient();
    const body = await c.getText('/api/data');

    expect(body).toBe('{"ok":2}');
    expect(state.calls).toHaveLength(6);
  });

  it('does not re-warm again when warmed flag is already set', async () => {
    state.queue.push(
      resp('<html>shell-1</html>'),
      resp('<html>warm1</html>'),
      resp('<html>warm2</html>'),
      resp('<html>warm3</html>'),
      resp('<html>still-shell-1</html>'),
      resp('<html>still-shell-2</html>'),
      resp('final-mode-ok')
    );

    const c = new UsitcClient();
    const body = await c.getText('/api/data');

    expect(body).toBe('final-mode-ok');
    // 1 initial + 3 warm + 1 retry + 1 next-mode + 1 last-mode
    expect(state.calls).toHaveLength(7);
  });

  it('falls back to the next header mode on fetch errors', async () => {
    state.queue.push(new Error('network fail'), resp('ok-mode-2'));

    const c = new UsitcClient();
    const body = await c.getText('/api/data');

    expect(body).toBe('ok-mode-2');
    expect(state.calls).toHaveLength(2);
  });

  it('uses final re-warm + last mode attempt when all modes fail', async () => {
    state.queue.push(
      new Error('m1'),
      new Error('m2'),
      new Error('m3'),
      resp('<html>warm1</html>'),
      resp('<html>warm2</html>'),
      resp('<html>warm3</html>'),
      resp('final-ok')
    );

    const c = new UsitcClient();
    const body = await c.getText('/api/data');

    expect(body).toBe('final-ok');
    expect(state.calls).toHaveLength(7);
  });

  it('getJson salvages JSON wrapped in non-JSON text', async () => {
    state.queue.push(resp('prefix {"a":1} suffix'));

    const c = new UsitcClient();
    await expect(c.getJson('/api/json')).resolves.toEqual({ a: 1 });
  });

  it('getJson throws a preview when body is not JSON', async () => {
    state.queue.push(resp('not json at all'));

    const c = new UsitcClient();
    await expect(c.getJson('/api/json')).rejects.toThrow('Failed to parse JSON: not json at all');
  });

  it('getJson throws on empty body', async () => {
    state.queue.push(resp('   '));

    const c = new UsitcClient();
    await expect(c.getJson('/api/json')).rejects.toThrow('Failed to parse JSON');
  });

  it('covers referer/site variants and HTTP error preview branch', async () => {
    state.queue.push(resp('upstream failed', 500), resp('ok'));
    const c = new UsitcClient();

    const out = await c.getText('https://www.usitc.gov/some/path');
    expect(out).toBe('ok');
    expect(state.calls).toHaveLength(2);

    const firstHeaders = (state.calls[0]?.init?.headers ?? {}) as Record<string, string>;
    const secondHeaders = (state.calls[1]?.init?.headers ?? {}) as Record<string, string>;
    expect(firstHeaders['Sec-Fetch-Site']).toBe('same-site');
    expect(firstHeaders.Referer).toBe('https://www.usitc.gov/harmonized_tariff_information');
    expect(secondHeaders['Sec-Fetch-Site']).toBe('same-site');
  });

  it('handles invalid URLs by falling back gracefully', async () => {
    state.queue.push(resp('ok'));
    const c = new UsitcClient('https://example.com');
    const out = await c.getText('http:::/bad-url');
    expect(out).toBe('ok');
  });

  it('falls back to request host for cookies without explicit domain', async () => {
    state.queue.push(resp('ok-1', 200, { 'set-cookie': 'naked=1; Path=/' }), resp('ok-2'));

    const c = new UsitcClient();
    await c.getText('/api/one');
    await c.getText('/api/two');

    const secondHeaders = (state.calls[1]?.init?.headers ?? {}) as Record<string, string>;
    expect(secondHeaders.Cookie).toContain('naked=1');
  });

  it('defaults cookie path to / when Path attribute is missing', async () => {
    state.queue.push(
      resp('ok-1', 200, { 'set-cookie': 'rooted=1; Domain=hts.usitc.gov' }),
      resp('ok-2')
    );

    const c = new UsitcClient();
    await c.getText('/api/one');
    await c.getText('/other/two');

    const secondHeaders = (state.calls[1]?.init?.headers ?? {}) as Record<string, string>;
    expect(secondHeaders.Cookie).toContain('rooted=1');
  });

  it('does not send cookies when path does not match cookie path scope', async () => {
    state.queue.push(
      resp('ok-1', 200, { 'set-cookie': 'scoped=1; Domain=hts.usitc.gov; Path=/api' }),
      resp('ok-2')
    );

    const c = new UsitcClient();
    await c.getText('/api/one');
    await c.getText('/other/two');

    const secondHeaders = (state.calls[1]?.init?.headers ?? {}) as Record<string, string>;
    expect(secondHeaders.Cookie).toBeUndefined();
  });

  it('ignores cookies without domain when reqUrl cannot be parsed', async () => {
    state.queue.push(resp('ok-1', 200, { 'set-cookie': 'nodomain=1; Path=/' }), resp('ok-2'));

    const c = new UsitcClient('https://example.com');
    await c.getText('http:::/bad-url');
    await c.getText('/api/next');

    const secondHeaders = (state.calls[1]?.init?.headers ?? {}) as Record<string, string>;
    expect(secondHeaders.Cookie).toBeUndefined();
  });

  it('replaces existing cookies with same name/domain/path', async () => {
    state.queue.push(
      resp('ok-1', 200, { 'set-cookie': 'token=old; Domain=hts.usitc.gov; Path=/' }),
      resp('ok-2', 200, { 'set-cookie': 'token=new; Domain=hts.usitc.gov; Path=/' }),
      resp('ok-3')
    );

    const c = new UsitcClient();
    await c.getText('/one');
    await c.getText('/two');
    await c.getText('/three');

    const thirdHeaders = (state.calls[2]?.init?.headers ?? {}) as Record<string, string>;
    expect(thirdHeaders.Cookie).toContain('token=new');
    expect(thirdHeaders.Cookie).not.toContain('token=old');
  });

  it('private cookieHeader handles path mismatch and storeCookies without reqUrl', async () => {
    const c = new UsitcClient() as any;
    c.jar = [{ name: 'p', value: '1', domain: 'hts.usitc.gov', path: '/api' }];

    const miss = c.cookieHeader('https://hts.usitc.gov/other/path');
    expect(miss).toBe('');

    c.storeCookies(new Response('ok', { headers: { 'set-cookie': 'bare=1; Path=/' } }), undefined);
    expect(c.jar.some((x: any) => x.name === 'bare')).toBe(false);
  });

  it('marks unrelated hosts as cross-site fetches', async () => {
    state.queue.push(resp('ok'));
    const c = new UsitcClient('https://hts.usitc.gov');
    await c.getText('https://example.org/data');

    const headers = (state.calls[0]?.init?.headers ?? {}) as Record<string, string>;
    expect(headers['Sec-Fetch-Site']).toBe('cross-site');
  });
});
