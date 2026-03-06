import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import usagePlugin, { _buffer, _circuit, flushBuffer, resetState } from '../api-usage.js';
import { __calls, __state } from '@clearcost/db';

vi.mock('drizzle-orm', () => {
  const sql = (lits: TemplateStringsArray, ...vals: any[]) => {
    let out = '';
    for (let i = 0; i < lits.length; i++) {
      out += lits[i];
      if (i < vals.length) out += String(vals[i]?.name ?? vals[i]);
    }
    return out;
  };
  return { sql };
});

// --- Mock @clearcost/db: capture insert + onConflictDoUpdate calls -----------------
declare module '@clearcost/db' {
  export const __calls: any[];
  export const __state: { failUpsert: boolean };
}
vi.mock('@clearcost/db', () => {
  const apiUsageTable = {
    apiKeyId: { name: 'apiKeyId' },
    day: { name: 'day' },
    route: { name: 'route' },
    method: { name: 'method' },
    count: { name: 'count' },
    sumDurationMs: { name: 'sumDurationMs' },
    sumBytesIn: { name: 'sumBytesIn' },
    sumBytesOut: { name: 'sumBytesOut' },
    updatedAt: { name: 'updatedAt' },
  } as const;

  const __calls: any[] = [];
  const __state = { failUpsert: false };

  const db = {
    insert: (tbl: any) => ({
      values: (vals: any) => ({
        onConflictDoUpdate: (args: any) => {
          if (__state.failUpsert) throw new Error('upsert failed');
          // Support bulk (array) and single-row inserts
          const rows = Array.isArray(vals) ? vals : [vals];
          for (const v of rows) {
            __calls.push({ tbl, vals: v, args });
          }
          return Promise.resolve();
        },
      }),
    }),
  };

  return { apiUsageTable, db, __calls, __state };
});

// Helpers
const dayStartUTC = (d = new Date()) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

function bearerApiKey(app: any, keyId = 'unit-key-1') {
  app.addHook('preHandler', async (req: any) => {
    req.apiKey = { id: keyId };
  });
}

describe('usage-plugin (unit)', () => {
  beforeEach(() => {
    __calls.length = 0;
    __state.failUpsert = false;
    resetState();
  });

  afterEach(() => {
    resetState();
  });

  it('skips when no apiKey on request', async () => {
    const app = Fastify();
    await app.register(usagePlugin);
    app.get('/public', async () => ({ ok: true }));

    const res = await app.inject({ method: 'GET', url: '/public' });
    expect(res.statusCode).toBe(200);

    // No buffer entries because req.apiKey is absent
    expect(_buffer.size).toBe(0);
    await app.close();
  });

  it('buffers one request and flushes with correct upsert values', async () => {
    const app = Fastify();
    await app.register(usagePlugin);
    bearerApiKey(app, 'unit-key-1');

    app.post('/echo/:id', async (_req, reply) => reply.send('XXXX')); // 4 bytes out

    const payload = JSON.stringify({ a: 1 });
    const res = await app.inject({
      method: 'POST',
      url: '/echo/42?x=1',
      payload,
      headers: { 'content-type': 'application/json', 'content-length': String(payload.length) },
    });
    expect(res.statusCode).toBe(200);

    // Event is buffered, not yet flushed
    expect(_buffer.size).toBe(1);
    expect(__calls.length).toBe(0);

    // Manually flush
    await flushBuffer();

    expect(__calls.length).toBe(1);
    const call = __calls[0];

    // Target constraint (composite key)
    expect(call.args.target.map((t: any) => t.name)).toEqual([
      'apiKeyId',
      'day',
      'route',
      'method',
    ]);

    // Insert values
    expect(call.vals.apiKeyId).toBe('unit-key-1');
    expect(call.vals.method).toBe('POST');
    expect(call.vals.route).toBe('/echo/:id');
    expect(call.vals.count).toBe(1);
    expect(call.vals.sumBytesIn).toBe(7);
    expect(call.vals.sumBytesOut).toBe(4);
    expect(call.vals.day.toISOString()).toBe(dayStartUTC().toISOString());

    // Arithmetic updates use excluded.* for bulk upsert
    const set = call.args.set;
    expect(String(set.count)).toContain('count + excluded.count');
    expect(String(set.sumBytesIn)).toContain('sumBytesIn + excluded.sum_bytes_in');
    expect(String(set.sumBytesOut)).toContain('sumBytesOut + excluded.sum_bytes_out');

    await app.close();
  });

  it('aggregates multiple requests to same route in buffer', async () => {
    const app = Fastify();
    await app.register(usagePlugin);
    bearerApiKey(app, 'unit-key-agg');

    app.get('/items', async () => 'ok');

    await app.inject({ method: 'GET', url: '/items' });
    await app.inject({ method: 'GET', url: '/items' });
    await app.inject({ method: 'GET', url: '/items' });

    // All three requests aggregated into one buffer entry
    expect(_buffer.size).toBe(1);
    const entry = [..._buffer.values()][0]!;
    expect(entry.count).toBe(3);
    expect(entry.sumBytesOut).toBe(6); // 'ok' = 2 bytes × 3

    await flushBuffer();
    expect(__calls.length).toBe(1);
    expect(__calls[0].vals.count).toBe(3);
    expect(String(__calls[0].args.set.count)).toContain('count + excluded.count');

    await app.close();
  });

  it('counts bytesOut when payload is a Buffer', async () => {
    const app = Fastify();
    await app.register(usagePlugin);
    bearerApiKey(app, 'unit-key-buffer');
    app.get('/bin', async (_req, reply) => reply.send(Buffer.from([1, 2, 3, 4, 5])));

    const res = await app.inject({ method: 'GET', url: '/bin' });
    expect(res.statusCode).toBe(200);

    await flushBuffer();
    expect(__calls.length).toBe(1);
    expect(__calls[0].vals.sumBytesOut).toBe(5);
    await app.close();
  });

  it('swallows metering failures and keeps request successful', async () => {
    __state.failUpsert = true;

    const app = Fastify();
    await app.register(usagePlugin);
    bearerApiKey(app, 'unit-key-fail');
    app.get('/ok', async () => ({ ok: true }));

    const res = await app.inject({ method: 'GET', url: '/ok' });
    expect(res.statusCode).toBe(200);

    // Buffered but flush fails — should not throw
    expect(_buffer.size).toBe(1);
    await flushBuffer(); // fails silently
    expect(__calls.length).toBe(0);
    // Entry re-buffered for retry
    expect(_buffer.size).toBe(1);

    await app.close();
  });

  it('recreates usage state when another hook clears req._usage', async () => {
    const app = Fastify();
    await app.register(usagePlugin);
    bearerApiKey(app, 'unit-key-reset');
    app.addHook('preHandler', async (req: any) => {
      req._usage = undefined;
    });
    app.get('/reset', async () => 'ok');

    const res = await app.inject({ method: 'GET', url: '/reset' });
    expect(res.statusCode).toBe(200);

    await flushBuffer();
    expect(__calls.length).toBe(1);
    expect(__calls[0].vals.sumBytesIn).toBe(0);
    expect(__calls[0].vals.sumBytesOut).toBe(2);
    await app.close();
  });

  it('handles empty string payload with zero-byte fallback counters', async () => {
    const app = Fastify();
    await app.register(usagePlugin);
    bearerApiKey(app, 'unit-key-empty');
    app.get('/empty', async () => '');

    const res = await app.inject({ method: 'GET', url: '/empty' });
    expect(res.statusCode).toBe(200);

    await flushBuffer();
    expect(__calls.length).toBe(1);
    expect(__calls[0].vals.sumBytesOut).toBe(0);
    expect(String(__calls[0].args.set.sumBytesOut)).toContain(
      'sumBytesOut + excluded.sum_bytes_out'
    );
    await app.close();
  });
});

describe('circuit breaker', () => {
  beforeEach(() => {
    __calls.length = 0;
    __state.failUpsert = false;
    resetState();
  });

  afterEach(() => {
    resetState();
  });

  it('opens circuit after consecutive failures', async () => {
    __state.failUpsert = true;
    const log = { warn: vi.fn() };

    // Simulate 5 consecutive flush failures
    for (let i = 0; i < 5; i++) {
      _buffer.set(`key-${i}`, {
        apiKeyId: 'k1',
        day: new Date(),
        route: '/test',
        method: 'GET',
        count: 1,
        sumDurationMs: 10,
        sumBytesIn: 0,
        sumBytesOut: 0,
      });
      await flushBuffer(log);
    }

    expect(_circuit.state).toBe('open');
    expect(_circuit.consecutiveFailures).toBe(5);
  });

  it('drops events while circuit is open during cooldown', async () => {
    _circuit.state = 'open';
    _circuit.openedAt = Date.now(); // just opened
    _circuit.droppedEvents = 0;

    _buffer.set('key-1', {
      apiKeyId: 'k1',
      day: new Date(),
      route: '/test',
      method: 'GET',
      count: 3,
      sumDurationMs: 30,
      sumBytesIn: 0,
      sumBytesOut: 0,
    });

    const log = { warn: vi.fn() };
    await flushBuffer(log);

    expect(_buffer.size).toBe(0);
    expect(_circuit.droppedEvents).toBe(3);
    expect(__calls.length).toBe(0);
  });

  it('transitions to half-open after cooldown and recovers on success', async () => {
    _circuit.state = 'open';
    _circuit.openedAt = Date.now() - 31_000; // cooldown elapsed
    __state.failUpsert = false;

    _buffer.set('key-1', {
      apiKeyId: 'k1',
      day: new Date(),
      route: '/test',
      method: 'GET',
      count: 1,
      sumDurationMs: 10,
      sumBytesIn: 0,
      sumBytesOut: 0,
    });

    const log = { warn: vi.fn() };
    await flushBuffer(log);

    expect(_circuit.state).toBe('closed');
    expect(_circuit.consecutiveFailures).toBe(0);
    expect(__calls.length).toBe(1);
  });

  it('re-opens circuit on half-open probe failure', async () => {
    _circuit.state = 'open';
    _circuit.openedAt = Date.now() - 31_000; // cooldown elapsed
    __state.failUpsert = true;

    _buffer.set('key-1', {
      apiKeyId: 'k1',
      day: new Date(),
      route: '/test',
      method: 'GET',
      count: 1,
      sumDurationMs: 10,
      sumBytesIn: 0,
      sumBytesOut: 0,
    });

    const log = { warn: vi.fn() };
    await flushBuffer(log);

    expect(_circuit.state).toBe('open');
    // Entry should be re-buffered
    expect(_buffer.size).toBe(1);
  });

  it('flushes on app close', async () => {
    const app = Fastify();
    await app.register(usagePlugin);
    bearerApiKey(app, 'unit-key-close');
    app.get('/test', async () => 'ok');

    await app.inject({ method: 'GET', url: '/test' });
    expect(_buffer.size).toBe(1);
    expect(__calls.length).toBe(0);

    // Close triggers final flush
    await app.close();
    expect(__calls.length).toBe(1);
    expect(_buffer.size).toBe(0);
  });
});
