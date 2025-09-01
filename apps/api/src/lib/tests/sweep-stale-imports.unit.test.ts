import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sweepStaleImports } from '../sweep-stale-imports.js';

type Row = {
  id: string;
  importStatus: 'running' | 'completed' | 'failed';
  updatedAt: Date;
  finishedAt?: Date | null;
  error?: string | null;
};

type Pred =
  | { type: 'eq'; left: keyof Row; right: any }
  | { type: 'lt'; left: keyof Row; right: any }
  | { type: 'and'; conds: Pred[] }
  | { type: 'in'; col: keyof Row; ids: any[] }
  | { type: 'noop' };

const { dbState } = vi.hoisted(() => ({
  dbState: {
    rows: [] as Row[],
    lastArgs: [] as any[],
  },
}));

type SqlToken = { __sql: string };

vi.mock('drizzle-orm', () => {
  const eq = (left: keyof Row, right: any) => ({ type: 'eq', left, right }) as const;
  const lt = (left: keyof Row, right: any) => ({ type: 'lt', left, right }) as const;
  const and = (...conds: Pred[]) => ({ type: 'and', conds }) as const;
  const inArray = (col: keyof Row, ids: any[]) => ({ type: 'in', col, ids }) as const;
  const asc = (col: keyof Row) => ({ type: 'asc', col }) as const;
  const sql = (lits: TemplateStringsArray, ..._vals: any[]): SqlToken => {
    return { __sql: lits.join('') };
  };
  return { eq, lt, and, inArray, asc, sql };
});

vi.mock('@clearcost/db', () => {
  const importsTable = {
    id: 'id',
    importStatus: 'importStatus',
    updatedAt: 'updatedAt',
    finishedAt: 'finishedAt',
    error: 'error',
  } as const;

  function isSqlToken(v: unknown): v is SqlToken {
    return !!v && typeof v === 'object' && '__sql' in (v as any);
  }

  function evalPred(pred: Pred, row: Row): boolean {
    if (!pred || pred.type === 'noop') return true;
    if (pred.type === 'eq') return (row as any)[pred.left] === pred.right;
    if (pred.type === 'lt') return (row as any)[pred.left] < pred.right;
    if (pred.type === 'in') return (pred.ids as any[]).includes((row as any)[pred.col]);
    if (pred.type === 'and') return pred.conds.every((p) => evalPred(p, row));
    return false;
  }

  const db = {
    update: (_tbl: any) => ({
      set: (vals: Partial<Row> & Record<string, any>) => ({
        where: (pred: Pred) => ({
          returning(map: Record<string, string | { name?: string }>) {
            const updated: Row[] = [];
            for (const r of dbState.rows) {
              if (evalPred(pred, r)) {
                const applied: Partial<Row> & Record<string, any> = { ...vals };
                if (isSqlToken(applied.finishedAt)) {
                  applied.finishedAt = new Date();
                }
                if (isSqlToken(applied.updatedAt)) {
                  applied.updatedAt = new Date();
                }
                Object.assign(r, applied);
                updated.push(r);
              }
            }
            return updated.map((r) => {
              const o: any = {};
              for (const k of Object.keys(map)) {
                const col = (map as any)[k];
                const name = typeof col === 'string' ? col : (col?.name ?? String(col));
                o[k] = (r as any)[name];
              }
              return o;
            });
          },
        }),
      }),
    }),

    select: (map: Record<string, string | { name?: string }>) => ({
      from: (_tbl: any) => ({
        where: (pred: Pred) => ({
          orderBy: (_dir: any) => ({
            limit(n: number) {
              const matched = dbState.rows
                .filter((r) => evalPred(pred, r))
                .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
                .slice(0, n);
              return matched.map((r) => {
                const o: any = {};
                for (const k of Object.keys(map)) {
                  const col = (map as any)[k];
                  const name = typeof col === 'string' ? col : (col?.name ?? String(col));
                  o[k] = (r as any)[name];
                }
                return o;
              });
            },
          }),
        }),
      }),
    }),
  };

  return { db, importsTable };
});

const FIXED_NOW = new Date('2025-09-01T00:00:00.000Z');

describe('sweepStaleImports', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    process.env = { ...OLD_ENV };
    dbState.rows.length = 0;
    dbState.lastArgs.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...OLD_ENV };
  });

  it('no limit: marks only stale running rows as failed (default 30m)', async () => {
    dbState.rows.push({
      id: 'r-stale',
      importStatus: 'running',
      updatedAt: new Date(FIXED_NOW.getTime() - 60 * 60_000),
    });
    dbState.rows.push({
      id: 'r-fresh',
      importStatus: 'running',
      updatedAt: new Date(FIXED_NOW.getTime() - 5 * 60_000),
    });
    dbState.rows.push({
      id: 'done',
      importStatus: 'completed',
      updatedAt: new Date(FIXED_NOW.getTime() - 120 * 60_000),
    });

    const res = await sweepStaleImports();
    expect(res.ok).toBe(true);
    expect(res.thresholdMinutes).toBe(30);
    expect(res.swept).toBe(1);

    const stale = dbState.rows.find((r) => r.id === 'r-stale')!;
    expect(stale.importStatus).toBe('failed');
    expect(stale.error).toBe('stale heartbeat > 30m');
    expect(stale.finishedAt instanceof Date).toBe(true);

    const fresh = dbState.rows.find((r) => r.id === 'r-fresh')!;
    expect(fresh.importStatus).toBe('running');

    const done = dbState.rows.find((r) => r.id === 'done')!;
    expect(done.importStatus).toBe('completed');
  });

  it('env IMPORT_STALE_MINUTES is honored', async () => {
    process.env.IMPORT_STALE_MINUTES = '5';
    dbState.rows.push({
      id: 'r1',
      importStatus: 'running',
      updatedAt: new Date(FIXED_NOW.getTime() - 7 * 60_000),
    });

    const res = await sweepStaleImports();
    expect(res.ok).toBe(true);
    expect(res.thresholdMinutes).toBe(5);
    expect(res.swept).toBe(1);

    const r1 = dbState.rows[0]!;
    expect(r1.importStatus).toBe('failed');
    expect(r1.error).toBe('stale heartbeat > 5m');
  });

  it('opts.thresholdMinutes overrides env/default', async () => {
    process.env.IMPORT_STALE_MINUTES = '5';
    dbState.rows.push({
      id: 'r2',
      importStatus: 'running',
      updatedAt: new Date(FIXED_NOW.getTime() - 10 * 60_000),
    });

    const res = await sweepStaleImports({ thresholdMinutes: 60 });
    expect(res.ok).toBe(true);
    expect(res.thresholdMinutes).toBe(60);
    expect(res.swept).toBe(0);

    expect(dbState.rows[0]!.importStatus).toBe('running');
  });

  it('limit path: selects oldest stale ids up to limit, updates only those', async () => {
    dbState.rows.push({
      id: 'a',
      importStatus: 'running',
      updatedAt: new Date(FIXED_NOW.getTime() - 90 * 60_000),
    });
    dbState.rows.push({
      id: 'b',
      importStatus: 'running',
      updatedAt: new Date(FIXED_NOW.getTime() - 45 * 60_000),
    });
    dbState.rows.push({
      id: 'c',
      importStatus: 'running',
      updatedAt: new Date(FIXED_NOW.getTime() - 5 * 60_000),
    });

    const res = await sweepStaleImports({ thresholdMinutes: 30, limit: 1 });
    expect(res.ok).toBe(true);
    expect(res.swept).toBe(1);

    const a = dbState.rows.find((r) => r.id === 'a')!;
    const b = dbState.rows.find((r) => r.id === 'b')!;
    expect(a.importStatus).toBe('failed');
    expect(b.importStatus).toBe('running');
  });

  it('limit path: returns swept=0 when no stale ids', async () => {
    dbState.rows.push({
      id: 'x',
      importStatus: 'running',
      updatedAt: new Date(FIXED_NOW.getTime() - 10 * 60_000),
    });

    const res = await sweepStaleImports({ thresholdMinutes: 30, limit: 10 });
    expect(res.ok).toBe(true);
    expect(res.swept).toBe(0);
    expect(dbState.rows[0]!.importStatus).toBe('running');
  });
});
