import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { withIdempotency } from '../idempotency.js';

type Row = {
  scope: string;
  key: string;
  requestHash: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  response?: unknown | null;
  updatedAt?: Date | null;
  lockedAt?: Date | null;
};

type ColKey = keyof Row;

type Pred =
  | { type: 'eq'; left: ColKey; right: any }
  | { type: 'and'; conds: Pred[] }
  | { type: 'isnull'; col: ColKey }
  | { type: 'noop' };

const { dbState } = vi.hoisted(() => ({
  dbState: {
    rows: [] as Row[],
  },
}));

vi.mock('drizzle-orm', () => {
  const eq = (left: ColKey, right: any): Pred => ({ type: 'eq', left, right });
  const and = (...conds: Pred[]): Pred => ({ type: 'and', conds });
  const sql = (lits: TemplateStringsArray, ...vals: any[]) => {
    const text = lits.join('');
    if (text.includes('IS NULL')) {
      // first interpolated value is the "column"
      const colName =
        typeof vals[0] === 'string'
          ? (vals[0] as ColKey)
          : ((vals[0]?.name ?? String(vals[0])) as ColKey);
      return { type: 'isnull', col: colName } as Pred;
    }
    return { type: 'noop' } as Pred;
  };
  return { eq, and, sql };
});

vi.mock('@clearcost/db', () => {
  const idempotencyKeysTable = {
    scope: 'scope',
    key: 'key',
    requestHash: 'requestHash',
    status: 'status',
    response: 'response',
    updatedAt: 'updatedAt',
    lockedAt: 'lockedAt',
  } as const;

  function getColName(col: any): ColKey {
    return (typeof col === 'string' ? col : (col?.name ?? String(col))) as ColKey;
  }

  function evalPred(pred: Pred, row: Row): boolean {
    if (pred.type === 'noop') return true;
    if (pred.type === 'eq') return row[pred.left] === pred.right;
    if (pred.type === 'isnull') return row[pred.col] == null;
    return pred.conds.every((p) => evalPred(p, row));
  }

  const tx = {
    insert: (_tbl: any) => ({
      values: (vals: Partial<Row>) => ({
        // ✅ make target a fixed 2-tuple so k1/k2 can't be undefined
        onConflictDoNothing: ({ target }: { target: readonly [ColKey, ColKey] }) => {
          const [k1, k2] = target;
          const exists = dbState.rows.find((r) => r[k1] === vals[k1] && r[k2] === vals[k2]);
          if (!exists) {
            dbState.rows.push({
              scope: (vals.scope ?? '') as string,
              key: (vals.key ?? '') as string,
              requestHash: (vals.requestHash ?? '') as string,
              status: (vals.status ?? 'pending') as Row['status'],
              response: vals.response ?? null,
              updatedAt: (vals.updatedAt ?? null) as Date | null,
              lockedAt: (vals.lockedAt ?? null) as Date | null,
            });
          }
          return Promise.resolve();
        },
      }),
    }),

    update: (_tbl: any) => ({
      set: (vals: Partial<Row>) => ({
        where: (pred: Pred) => {
          const updated: Row[] = [];
          for (const r of dbState.rows) {
            if (evalPred(pred, r)) {
              Object.assign(r, vals);
              updated.push(r);
            }
          }
          const api: any = {
            returning(map: Record<string, any>) {
              return Promise.resolve(
                updated.map((r) => {
                  const o: any = {};
                  for (const k of Object.keys(map)) {
                    const col = map[k];
                    const colName = getColName(col);
                    o[k] = r[colName];
                  }
                  return o;
                })
              );
            },
            then(onFulfilled: (v: number) => void) {
              onFulfilled(updated.length);
            },
          };
          return api;
        },
      }),
    }),

    select: (map: Record<string, any>) => ({
      from: (_tbl: any) => ({
        where: (pred: Pred) => ({
          async limit(n: number) {
            const matched = dbState.rows.filter((r) => evalPred(pred, r)).slice(0, n);
            return matched.map((r) => {
              const o: any = {};
              for (const k of Object.keys(map)) {
                const col = map[k];
                const colName = getColName(col);
                o[k] = r[colName];
              }
              return o;
            });
          },
        }),
      }),
    }),
  };

  const db = {
    async transaction<T>(fn: (txArg: typeof tx) => Promise<T>): Promise<T> {
      return await fn(tx);
    },
  };

  return { db, idempotencyKeysTable };
});

function json(headers: Record<string, string> = {}) {
  return { ...headers, 'content-type': 'application/json' };
}

beforeEach(() => {
  vi.useRealTimers();
});

async function waitUntilProcessing(key: string, timeoutMs = 1000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const row = dbState.rows.find((r) => r.key === key);
    if (row?.status === 'processing') return;
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error('Row never reached processing state');
}

describe('withIdempotency (integration via Fastify route)', () => {
  beforeEach(() => {
    dbState.rows.length = 0;
  });

  it('400 when Idempotency-Key header is missing', async () => {
    const app = Fastify();

    app.post('/idem', async (req, reply) => {
      try {
        const res = await withIdempotency(
          'orders',
          (req.headers['idempotency-key'] as string) || '',
          req.body,
          async () => ({ ok: true })
        );
        return reply.send(res);
      } catch (e: any) {
        return reply.code(e.statusCode ?? 500).send({ error: e.message });
      }
    });

    const r = await app.inject({ method: 'POST', url: '/idem', headers: json(), payload: '{}' });
    expect(r.statusCode).toBe(400);
    await app.close();
  });

  it('first-time proceeds; replay returns cached; conflict on different payload', async () => {
    const app = Fastify();
    const produced = vi.fn(async (body: any) => ({ ok: true, body }));

    app.post('/idem', async (req, reply) => {
      try {
        const res = await withIdempotency(
          'orders',
          (req.headers['idempotency-key'] as string) || '',
          req.body,
          () => produced(req.body)
        );
        return reply.send(res);
      } catch (e: any) {
        return reply.code(e.statusCode ?? 500).send({ error: e.message });
      }
    });

    const key = 'k-int-1';
    const r1 = await app.inject({
      method: 'POST',
      url: '/idem',
      headers: json({ 'idempotency-key': key }),
      payload: JSON.stringify({ n: 1 }),
    });
    expect(r1.statusCode).toBe(200);
    expect(JSON.parse(r1.body)).toEqual({ ok: true, body: { n: 1 } });
    expect(produced).toHaveBeenCalledTimes(1);

    const r2 = await app.inject({
      method: 'POST',
      url: '/idem',
      headers: json({ 'idempotency-key': key }),
      payload: JSON.stringify({ n: 1 }),
    });
    expect(r2.statusCode).toBe(200);
    expect(JSON.parse(r2.body)).toEqual({ ok: true, body: { n: 1 } });
    expect(produced).toHaveBeenCalledTimes(1);

    const r3 = await app.inject({
      method: 'POST',
      url: '/idem',
      headers: json({ 'idempotency-key': key }),
      payload: JSON.stringify({ n: 2 }),
    });
    expect(r3.statusCode).toBe(409);

    await app.close();
  });

  it('in-flight second request returns 409 Processing', async () => {
    const app = Fastify();

    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));

    app.post('/idem', async (req, reply) => {
      try {
        const res = await withIdempotency(
          'orders',
          (req.headers['idempotency-key'] as string) || '',
          req.body,
          async () => {
            await gate;
            return { ok: true };
          }
        );
        return reply.send(res);
      } catch (e: any) {
        return reply.code(e.statusCode ?? 500).send({ error: e.message });
      }
    });

    const key = 'k-int-2';

    const p1 = app.inject({
      method: 'POST',
      url: '/idem',
      headers: json({ 'idempotency-key': key }),
      payload: '{}',
    });

    await waitUntilProcessing(key);

    const r2 = await app.inject({
      method: 'POST',
      url: '/idem',
      headers: json({ 'idempotency-key': key }),
      payload: '{}',
    });
    expect(r2.statusCode).toBe(409);
    expect(r2.json().error).toBe('Processing');

    release();
    const r1 = await p1;
    expect(r1.statusCode).toBe(200);

    await app.close();
  });

  it('replay refresh: onReplay updates cached value when stale; not called when fresh', async () => {
    const app = Fastify();

    const onReplay = vi.fn(async (_cached: any) => ({ ok: 'refreshed' }));

    app.post('/idem-refresh', async (req, reply) => {
      try {
        const res = await withIdempotency(
          'orders',
          (req.headers['idempotency-key'] as string) || '',
          req.body,
          async () => ({ ok: 'initial' }),
          { onReplay, maxAgeMs: 1000 } // 1s
        );
        return reply.send(res);
      } catch (e: any) {
        return reply.code(e.statusCode ?? 500).send({ error: e.message });
      }
    });

    const key = 'k-int-3';

    const r1 = await app.inject({
      method: 'POST',
      url: '/idem-refresh',
      headers: json({ 'idempotency-key': key }),
      payload: '{}',
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json()).toEqual({ ok: 'initial' });

    const row = dbState.rows.find((r) => r.key === key)!;
    row.updatedAt = new Date(Date.now() - 5 * 60_000);

    const r2 = await app.inject({
      method: 'POST',
      url: '/idem-refresh',
      headers: json({ 'idempotency-key': key }),
      payload: '{}',
    });
    expect(r2.statusCode).toBe(200);
    expect(r2.json()).toEqual({ ok: 'refreshed' });
    expect(onReplay).toHaveBeenCalledTimes(1);

    const r3 = await app.inject({
      method: 'POST',
      url: '/idem-refresh',
      headers: json({ 'idempotency-key': key }),
      payload: '{}',
    });
    expect(r3.statusCode).toBe(200);
    expect(r3.json()).toEqual({ ok: 'refreshed' });
    expect(onReplay).toHaveBeenCalledTimes(1);

    await app.close();
  });
});
