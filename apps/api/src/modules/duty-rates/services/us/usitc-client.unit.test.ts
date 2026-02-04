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

  it('falls back to the next header mode on fetch errors', async () => {
    state.queue.push(new Error('network fail'), resp('ok-mode-2'));

    const c = new UsitcClient();
    const body = await c.getText('/api/data');

    expect(body).toBe('ok-mode-2');
    expect(state.calls).toHaveLength(2);
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
});
