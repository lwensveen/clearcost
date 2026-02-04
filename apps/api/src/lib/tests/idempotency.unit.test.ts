import { beforeEach, describe, expect, it, vi } from 'vitest';
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

type Pred =
  | { type: 'eq'; left: string; right: any }
  | { type: 'and'; conds: Pred[] }
  | { type: 'isnull'; col: string }
  | { type: 'noop' };

const { dbState } = vi.hoisted(() => ({
  dbState: {
    rows: [] as Row[],
  },
}));

vi.mock('drizzle-orm', () => {
  return {
    eq: (left: any, right: any) => ({ type: 'eq', left, right }) as Pred,
    and: (...conds: Pred[]) => ({ type: 'and', conds }) as Pred,
    sql: (lits: TemplateStringsArray, ...vals: any[]) => {
      const text = lits.join('');
      if (text.includes('IS NULL')) {
        const col = typeof vals[0] === 'string' ? vals[0] : (vals[0]?.name ?? String(vals[0]));
        return { type: 'isnull', col } as Pred;
      }
      return { type: 'noop' };
    },
  };
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

  function evalPred(pred: Pred, row: Row): boolean {
    if (pred.type === 'noop') return true;
    if (pred.type === 'eq') return (row as any)[pred.left] === pred.right;
    if (pred.type === 'isnull') return (row as any)[pred.col] == null;
    // and
    return pred.conds.every((p) => evalPred(p, row));
  }

  const tx = {
    insert: (_tbl: any) => ({
      values: (vals: Partial<Row>) => ({
        onConflictDoNothing: ({ target }: { target: string[] }) => {
          const exists = dbState.rows.find(
            (r) =>
              (r as any)[target[0]!] === (vals as any)[target[0]!] &&
              (r as any)[target[1]!] === (vals as any)[target[1]!]
          );
          if (!exists) {
            dbState.rows.push({
              scope: vals.scope!,
              key: vals.key!,
              requestHash: vals.requestHash!,
              status: vals.status ?? 'pending',
              response: vals.response ?? null,
              updatedAt: vals.updatedAt ?? null,
              lockedAt: vals.lockedAt ?? null,
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

          return {
            returning(map: Record<string, string>) {
              return Promise.resolve(
                updated.map((r) => {
                  const o: any = {};
                  for (const k of Object.keys(map)) {
                    const col = (map as any)[k];
                    const colName = typeof col === 'string' ? col : (col?.name ?? String(col));
                    o[k] = (r as any)[colName];
                  }
                  return o;
                })
              );
            },
            // Make await-able (await .where() -> resolves to count)
            then(onFulfilled: (v: number) => void) {
              onFulfilled(updated.length);
            },
          };
        },
      }),
    }),

    select: (map: Record<string, string>) => ({
      from: (_tbl: any) => ({
        where: (pred: Pred) => ({
          async limit(n: number) {
            const matched = dbState.rows.filter((r) => evalPred(pred, r)).slice(0, n);
            return matched.map((r) => {
              const o: any = {};
              for (const k of Object.keys(map)) {
                const col = (map as any)[k];
                const colName = typeof col === 'string' ? col : (col?.name ?? String(col));
                o[k] = (r as any)[colName];
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

describe('withIdempotency (unit)', () => {
  beforeEach(() => {
    dbState.rows.length = 0;
  });

  it('throws 400 when key is missing', async () => {
    await expect(
      withIdempotency('s', '', { a: 1 }, async () => ({ ok: true }))
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('first-time: produces, stores completed row, returns result; second call returns cached', async () => {
    const producer = vi.fn(async () => ({ ok: true, n: 1 }));

    const a = await withIdempotency('s', 'k1', { a: 1 }, producer);
    expect(a).toEqual({ ok: true, n: 1 });
    expect(producer).toHaveBeenCalledTimes(1);

    expect(dbState.rows).toHaveLength(1);
    expect(dbState.rows[0]!.status).toBe('completed');

    const b = await withIdempotency('s', 'k1', { a: 1 }, producer);
    expect(b).toEqual({ ok: true, n: 1 });
    expect(producer).toHaveBeenCalledTimes(1); // cached, no second call
  });

  it('conflict: same key with different payload => 409', async () => {
    await withIdempotency('s', 'k2', { a: 1 }, async () => ({ ok: true }));
    await expect(
      withIdempotency('s', 'k2', { a: 2 }, async () => ({ ok: true }))
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Idempotency key reused with different payload',
    });
  });

  it('throws conflict when a claimed pending row has a different request hash', async () => {
    dbState.rows.push({
      scope: 's',
      key: 'k-claimed-mismatch',
      requestHash: 'different-hash',
      status: 'pending',
      response: null,
      updatedAt: null,
      lockedAt: null,
    });

    await expect(
      withIdempotency('s', 'k-claimed-mismatch', { a: 1 }, async () => ({ ok: true }))
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Idempotency key reused with different payload',
    });
  });

  it('in-flight: second call sees processing and gets 409 Processing', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));

    const p1 = withIdempotency('s', 'k3', { a: 1 }, async () => {
      await gate;
      return { ok: true };
    });

    const p2 = withIdempotency('s', 'k3', { a: 1 }, async () => ({ ok: false }));

    await expect(p2).rejects.toMatchObject({ statusCode: 409, message: 'Processing' });

    release();
    await p1;
  });

  it('failure: producer throws -> row marked failed; next call 409 Previous attempt failed', async () => {
    await expect(
      withIdempotency('s', 'k4', { a: 1 }, async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    expect(dbState.rows[0]!.status).toBe('failed');

    await expect(
      withIdempotency('s', 'k4', { a: 1 }, async () => ({ ok: true }))
    ).rejects.toMatchObject({ statusCode: 409, message: 'Previous attempt failed; use a new key' });
  });

  it('replay: completed + onReplay(null) keeps cached; onReplay(value) updates and returns; respects maxAgeMs', async () => {
    const out1 = await withIdempotency('s', 'k5', { a: 1 }, async () => ({ ok: 1 }));
    expect(out1).toEqual({ ok: 1 });
    const row = dbState.rows.find((r) => r.key === 'k5')!;

    row.updatedAt = new Date(Date.now() - 60_000);

    const onReplayNull = vi.fn(async () => null);
    const out2 = await withIdempotency('s', 'k5', { a: 1 }, async () => ({ ok: 99 }), {
      onReplay: onReplayNull,
      maxAgeMs: 1000,
    });
    expect(onReplayNull).toHaveBeenCalledTimes(1);
    expect(out2).toEqual({ ok: 1 });

    const onReplayVal = vi.fn(async () => ({ ok: 2 }));
    const out3 = await withIdempotency('s', 'k5', { a: 1 }, async () => ({ ok: 99 }), {
      onReplay: onReplayVal,
      maxAgeMs: 1000,
    });
    expect(onReplayVal).toHaveBeenCalledTimes(1);
    expect(out3).toEqual({ ok: 2 });

    const row2 = dbState.rows.find((r) => r.key === 'k5')!;
    row2.updatedAt = new Date();
    const onReplaySkip = vi.fn(async () => ({ ok: 3 }));
    const out4 = await withIdempotency('s', 'k5', { a: 1 }, async () => ({ ok: 99 }), {
      onReplay: onReplaySkip,
      maxAgeMs: 60_000,
    });
    expect(onReplaySkip).not.toHaveBeenCalled();
    expect(out4).toEqual({ ok: 2 });
  });
});
