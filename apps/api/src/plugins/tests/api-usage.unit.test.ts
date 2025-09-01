import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import usagePlugin from '../api-usage.js';
import { __calls } from '@clearcost/db';

vi.mock('drizzle-orm', () => {
  const sql = (lits: TemplateStringsArray, ...vals: any[]) => {
    // produce a readable string like: `${table.count} + 1` -> "[count] + 1"
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

  const db = {
    insert: (tbl: any) => ({
      values: (vals: any) => ({
        onConflictDoUpdate: (args: any) => {
          __calls.push({ tbl, vals, args });
          return Promise.resolve();
        },
      }),
    }),
  };

  return { apiUsageTable, db, __calls };
});

// Helpers
const dayStartUTC = (d = new Date()) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

function bearerApiKey(app: any, keyId = 'unit-key-1') {
  // add a preHandler that stashes a fake principal on req
  app.addHook('preHandler', async (req: any) => {
    req.apiKey = { id: keyId };
  });
}

describe('usage-plugin (unit)', () => {
  beforeEach(() => {
    __calls.length = 0;
  });

  it('skips when no apiKey on request', async () => {
    const app = Fastify();
    await app.register(usagePlugin);
    app.get('/public', async () => ({ ok: true }));

    const res = await app.inject({ method: 'GET', url: '/public' });
    expect(res.statusCode).toBe(200);

    // No DB calls because req.apiKey is absent
    expect(__calls.length).toBe(0);
    await app.close();
  });

  it('records one request with correct insert + upsert target and arithmetic set', async () => {
    const app = Fastify();
    await app.register(usagePlugin);
    bearerApiKey(app, 'unit-key-1');

    // Route with param; plugin should store route pattern, e.g. "/echo/:id"
    app.post('/echo/:id', async (_req, reply) => reply.send('XXXX')); // 4 bytes out

    const payload = JSON.stringify({ a: 1 });
    const res = await app.inject({
      method: 'POST',
      url: '/echo/42?x=1',
      payload,
      headers: { 'content-type': 'application/json', 'content-length': String(payload.length) },
    });
    expect(res.statusCode).toBe(200);

    // One upsert call captured
    expect(__calls.length).toBe(1);
    const call = __calls[0];

    // Target constraint (composite key)
    expect(call.args.target.map((t: any) => t.name)).toEqual([
      'apiKeyId',
      'day',
      'route',
      'method',
    ]);

    // Initial insert values
    expect(call.vals.apiKeyId).toBe('unit-key-1');
    expect(call.vals.method).toBe('POST');
    expect(call.vals.route).toBe('/echo/:id');
    expect(call.vals.count).toBe(1);
    expect(call.vals.sumBytesIn).toBe(7);
    expect(call.vals.sumBytesOut).toBe(4);
    expect(call.vals.day.toISOString()).toBe(dayStartUTC().toISOString());

    // Arithmetic updates are present (stringified by our mock sql)
    const set = call.args.set;
    expect(String(set.count)).toContain('count + 1');
    expect(String(set.sumDurationMs)).toMatch(/sumDurationMs \+ \d+/);
    expect(String(set.sumBytesIn)).toContain('sumBytesIn + 7');
    expect(String(set.sumBytesOut)).toContain('sumBytesOut + 4');

    await app.close();
  });
});
