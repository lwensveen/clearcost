import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Adjust if your file lives elsewhere */
const SUT = './dispatch.js';

/* -------------------- Mocks & state -------------------- */

type Endpoint = {
  id: string;
  ownerId: string;
  url: string;
  events: string[] | null;
  isActive: boolean;
  secretEnc: string;
  secretIv: string;
  secretTag: string;
};

type Delivery = {
  id: string;
  endpointId: string;
  event: string;
  payload: any;
  attempt: number;
  status: 'pending' | 'success' | 'failed';
  responseStatus?: number | null;
  responseBody?: string | null;
  deliveredAt?: Date | null;
  updatedAt?: Date | null;
  nextAttemptAt?: Date | null;
};

const { state } = vi.hoisted(() => ({
  state: {
    endpoints: [] as Endpoint[],
    deliveries: [] as Delivery[],
    seq: 0,
    // for endpoint selection; our db mock uses this as "owner filter"
    currentOwnerId: '',
    // decryptSecret control
    decryptThrows: false,
    // fetch queue; items can be number (status), or {status,text}, or a fn
    fetchQueue: [] as Array<
      number | { status: number; body?: string } | ((url: string, init: any) => any)
    >,
    // last request snapshot
    lastRequest: null as null | { url: string; init: any },
  },
}));

/* --- mock drizzle preds so we can read ids in .where(eq(...)) --- */
vi.mock('drizzle-orm', () => {
  return {
    eq: (left: any, right: any) => ({ type: 'eq', left, right }),
    and: (...conds: any[]) => ({ type: 'and', conds }),
  };
});

/* --- mock @clearcost/db with minimal behavior needed by SUT --- */
vi.mock('@clearcost/db', () => {
  const webhookEndpointsTable = {
    __name: 'endpoints',
    id: 'id',
    ownerId: 'ownerId',
    url: 'url',
    events: 'events',
    isActive: 'isActive',
    secretEnc: 'secretEnc',
    secretIv: 'secretIv',
    secretTag: 'secretTag',
  } as const;

  const webhookDeliveriesTable = {
    __name: 'deliveries',
    id: 'id',
    endpointId: 'endpointId',
    event: 'event',
    payload: 'payload',
    attempt: 'attempt',
    status: 'status',
    responseStatus: 'responseStatus',
    responseBody: 'responseBody',
    deliveredAt: 'deliveredAt',
    updatedAt: 'updatedAt',
    nextAttemptAt: 'nextAttemptAt',
  } as const;

  function extractEqId(pred: any): string | undefined {
    if (pred?.type === 'eq') {
      return pred.right;
    }
    if (pred?.type === 'and') {
      for (const p of pred.conds ?? []) {
        const v = extractEqId(p);
        if (v) return v;
      }
    }
    return undefined;
  }

  const db = {
    /* SELECT ... FROM ... WHERE ... [LIMIT 1] */
    select: (_shape?: any) => ({
      from: (tbl: any) => ({
        where: (pred: any) => {
          if (tbl.__name === 'endpoints') {
            // Return active endpoints for current owner
            const list = state.endpoints.filter(
              (e) => e.ownerId === state.currentOwnerId && e.isActive
            );
            // shape maps to { id, url, events, secretEnc, secretIv, secretTag }
            return Promise.resolve(
              list.map((e) => ({
                id: e.id,
                url: e.url,
                events: e.events,
                secretEnc: e.secretEnc,
                secretIv: e.secretIv,
                secretTag: e.secretTag,
              }))
            );
          }
          // deliveries lookups -> expect LIMIT(1)
          return {
            limit: async (_n: number) => {
              const id = extractEqId(pred);
              const row = state.deliveries.find((d) => d.id === id);
              if (!row) return [];
              return [{ attempt: row.attempt, status: row.status }];
            },
          };
        },
      }),
    }),

    /* INSERT ... VALUES ... RETURNING({ id }) */
    insert: (tbl: any) => ({
      values: (vals: any) => ({
        returning: async (_shape: any) => {
          if (tbl.__name === 'deliveries') {
            const id = `del-${++state.seq}`;
            const row: Delivery = {
              id,
              deliveredAt: null,
              updatedAt: new Date(),
              nextAttemptAt: vals?.nextAttemptAt ?? null,
              responseBody: null,
              responseStatus: null,
              ...vals,
            };
            state.deliveries.push(row);
            return [{ id }];
          }
          return [];
        },
      }),
    }),

    /* UPDATE ... SET ... WHERE ... */
    update: (tbl: any) => ({
      set: (setVals: any) => ({
        where: async (pred: any) => {
          if (tbl.__name === 'deliveries') {
            const id = extractEqId(pred);
            const row = state.deliveries.find((d) => d.id === id);
            if (row) Object.assign(row, setVals);
          }
        },
      }),
    }),
  };

  return { db, webhookEndpointsTable, webhookDeliveriesTable };
});

/* --- mock decryptSecret --- */
const decryptSpy = vi.fn<(enc: string, iv: string, tag: string) => string>(() => 'sekret-123');

vi.mock('./secret-kms.js', () => ({
  decryptSecret: (enc: string, iv: string, tag: string) => decryptSpy(enc, iv, tag),
}));

/* --- mock global fetch --- */
const fetchMock = vi.fn(async (url: string, init: any) => {
  state.lastRequest = { url, init };
  const next = state.fetchQueue.shift();
  if (typeof next === 'function') return await next(url, init);
  const status =
    typeof next === 'number' ? next : typeof next === 'object' && next ? next.status : 200;
  const body =
    (typeof next === 'object' && next && next.body) ||
    (status >= 200 && status < 300 ? 'OK' : 'ERR');
  return {
    status,
    async text() {
      return body;
    },
  };
});

vi.stubGlobal('fetch', fetchMock);

/* -------------------- Helpers -------------------- */

async function importSut() {
  vi.resetModules();
  const mod = await import(SUT);
  return mod as typeof import('./dispatch.js');
}

function seedEndpoint(partial: Partial<Endpoint>): Endpoint {
  const ep: Endpoint = {
    id: `ep-${state.endpoints.length + 1}`,
    ownerId: 'owner-1',
    url: 'https://example.test/webhook',
    events: null,
    isActive: true,
    secretEnc: 'enc',
    secretIv: 'iv',
    secretTag: 'tag',
    ...partial,
  };
  state.endpoints.push(ep);
  return ep;
}

/* -------------------- Tests -------------------- */

describe('emitWebhook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-09-01T12:00:00.000Z'));
    state.endpoints = [];
    state.deliveries = [];
    state.seq = 0;
    state.currentOwnerId = 'owner-1';
    state.fetchQueue = [];
    state.lastRequest = null;
    decryptSpy.mockReset();
    decryptSpy.mockImplementation(() => 'sekret-123');
    fetchMock.mockClear();
  });

  it('creates a delivery and marks success on 2xx; signs request correctly', async () => {
    const { emitWebhook } = await importSut();

    seedEndpoint({ events: null }); // accepts all
    state.fetchQueue.push({ status: 204, body: 'ok' });

    await emitWebhook('owner-1', 'quote.created', { id: 123 });

    // let the "fire-and-forget" async attempt finish
    await Promise.resolve();
    await Promise.resolve();

    expect(state.deliveries.length).toBe(1);
    const del = state.deliveries[0]!;
    expect(del.status).toBe('success');
    expect(del.attempt).toBe(1);
    expect(del.responseStatus).toBe(204);
    expect(del.responseBody).toBe('ok');
    expect(del.deliveredAt).toBeInstanceOf(Date);
    expect(del.nextAttemptAt).toBeNull();

    // fetch called once with proper headers, body and signature
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const req = state.lastRequest!;
    expect(req.init?.headers?.['content-type']).toBe('application/json');
    expect(req.init?.headers?.['user-agent']).toBe('ClearCost-Webhooks/1.0');

    const body = req.init?.body;
    expect(body).toBe(JSON.stringify({ type: 'quote.created', data: { id: 123 } }));

    const sigHdr = req.init?.headers?.['clearcost-signature'] as string;
    expect(sigHdr).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);

    // verify HMAC matches our secret + frozen time
    const ts = Math.floor(new Date('2025-09-01T12:00:00.000Z').getTime() / 1000);
    const expected = require('node:crypto')
      .createHmac('sha256', 'sekret-123')
      .update(`${ts}.${body}`)
      .digest('hex');
    expect(sigHdr).toBe(`t=${ts},v1=${expected}`);
  });

  it('skips endpoints that do not subscribe to the event', async () => {
    const { emitWebhook } = await importSut();

    // This one subscribes to a different event - should be skipped
    seedEndpoint({ events: ['invoice.created'] });
    // This one matches and should be used
    seedEndpoint({ events: ['quote.created'] });

    state.fetchQueue.push(200);

    await emitWebhook('owner-1', 'quote.created', { z: 1 });
    await Promise.resolve();
    await Promise.resolve();

    // Only one delivery created (for the matching endpoint)
    expect(state.deliveries.length).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('marks delivery failed immediately when secret decrypt throws and does not call fetch', async () => {
    const { emitWebhook } = await importSut();

    decryptSpy.mockImplementation(() => {
      throw new Error('bad key');
    });
    seedEndpoint({ events: null });

    await emitWebhook('owner-1', 'quote.created', { a: 1 });

    await Promise.resolve();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.deliveries.length).toBe(1);
    const del = state.deliveries[0]!;
    expect(del.attempt).toBe(1);
    expect(del.status).toBe('failed');
    expect(del.responseStatus).toBe(0);
    expect(String(del.responseBody)).toMatch(/secret decrypt error/i);
    expect(del.nextAttemptAt).toBeNull();
  });

  it('retries with backoff (1m, 5m) and succeeds on third attempt', async () => {
    const { emitWebhook } = await importSut();

    seedEndpoint({ events: null });

    // Fail, fail, then succeed
    state.fetchQueue.push(500, 500, 200);

    await emitWebhook('owner-1', 'quote.created', { id: 'x' });

    // 1st attempt processed
    await Promise.resolve();
    await Promise.resolve();
    let del = state.deliveries[0]!;
    expect(del.attempt).toBe(1);
    expect(del.status).toBe('pending');
    expect(del.nextAttemptAt).toBeInstanceOf(Date);

    // Run 1-minute backoff
    await vi.advanceTimersByTimeAsync(60_000);
    await Promise.resolve();
    await Promise.resolve();

    del = state.deliveries[0]!;
    expect(del.attempt).toBe(2);
    expect(del.status).toBe('pending');

    // Run 5-minute backoff
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    await Promise.resolve();
    await Promise.resolve();

    del = state.deliveries[0]!;
    expect(del.attempt).toBe(3);
    expect(del.status).toBe('success');
    expect(del.nextAttemptAt).toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not select endpoints for other owners (mocked owner filter)', async () => {
    const { emitWebhook } = await importSut();

    // Endpoints for different owners
    seedEndpoint({ ownerId: 'owner-2', events: null });
    seedEndpoint({ ownerId: 'owner-3', events: ['quote.created'] });
    // Matching owner endpoint
    seedEndpoint({ ownerId: 'owner-1', events: ['quote.created'] });

    state.fetchQueue.push(200);

    await emitWebhook('owner-1', 'quote.created', {});
    await Promise.resolve();
    await Promise.resolve();

    expect(state.deliveries.length).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
