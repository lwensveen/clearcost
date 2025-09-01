import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { acquireRunLock, makeLockKey, releaseRunLock } from '../run-lock.js';
import { db } from '@clearcost/db';

// Shape of what our mocked PG results can look like
type LockRow = { locked: boolean | 't' | 'f' };
type NextResult = LockRow[] | LockRow | [];

// Shape of the SQL wrapper object our mocked drizzle `sql` returns
type SqlArg = { __text: string; __vals: any[] };

const { state } = vi.hoisted(() => ({
  state: {
    nextResult: [] as NextResult,
    lastArg: null as SqlArg | null,
  },
}));

vi.mock('drizzle-orm', () => {
  const sql = (lits: TemplateStringsArray, ...vals: any[]) => {
    let text = '';
    for (let i = 0; i < lits.length; i++) {
      text += lits[i];
      if (i < vals.length) text += `{$${i + 1}}`;
    }
    return { __text: text, __vals: vals };
  };
  return { sql };
});

vi.mock('@clearcost/db', () => {
  const execute = vi.fn(async (arg: any) => {
    state.lastArg = arg;
    return state.nextResult;
  });
  return {
    db: { execute },
  };
});

describe('run-lock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.nextResult = [];
    state.lastArg = null;
  });

  describe('makeLockKey', () => {
    it('formats default source:job', () => {
      expect(makeLockKey({ importSource: 'SRC', job: 'JOB' })).toBe('SRC:JOB');
    });

    it('includes extra when provided', () => {
      expect(makeLockKey({ importSource: 'SRC', job: 'JOB' }, 'tenantA')).toBe('SRC:JOB:tenantA');
    });
  });

  describe('acquireRunLock', () => {
    it('returns true when PG returns boolean true (array shape)', async () => {
      state.nextResult = [{ locked: true }];
      await expect(acquireRunLock('k1')).resolves.toBe(true);

      // Ensure lastArg is set by our mock
      expect(state.lastArg).toBeTruthy();
      expect(state.lastArg!.__text).toContain('pg_try_advisory_lock');
      expect(state.lastArg!.__text).toContain('hashtext(');
      expect(state.lastArg!.__vals[0]).toBe('k1');

      const executeMock = db.execute as unknown as Mock;
      expect(executeMock.mock.calls.length).toBe(1);
    });

    it('returns true when PG returns "t" (array shape)', async () => {
      state.nextResult = [{ locked: 't' }];
      await expect(acquireRunLock('k2')).resolves.toBe(true);
    });

    it('returns false when PG returns boolean false (array shape)', async () => {
      state.nextResult = [{ locked: false }];
      await expect(acquireRunLock('k3')).resolves.toBe(false);
    });

    it('returns false when PG returns "f" (object shape)', async () => {
      state.nextResult = { locked: 'f' };
      await expect(acquireRunLock('k4')).resolves.toBe(false);
    });

    it('defensive: returns false when result missing', async () => {
      state.nextResult = [];
      await expect(acquireRunLock('k5')).resolves.toBe(false);
    });
  });

  describe('releaseRunLock', () => {
    it('executes advisory unlock with provided key', async () => {
      state.nextResult = [];

      await releaseRunLock('rel-1');

      const executeMock = db.execute as unknown as Mock;
      expect(executeMock.mock.calls.length).toBe(1);

      expect(state.lastArg).toBeTruthy();
      expect(state.lastArg!.__text).toContain('pg_advisory_unlock');
      expect(state.lastArg!.__text).toContain('hashtext(');
      expect(state.lastArg!.__vals[0]).toBe('rel-1');
    });
  });
});
