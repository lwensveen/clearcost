import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importErrors, importRowsInserted, setLastRunNow, startImportTimer } from '../metrics.js';
import { finishImportRun, startImportRun } from '../provenance.js';
import { acquireRunLock, releaseRunLock } from '../run-lock.js';
import { withRun } from './runtime.js';

const { endTimerSpy } = vi.hoisted(() => ({ endTimerSpy: vi.fn() }));

vi.mock('../metrics.js', () => ({
  importRowsInserted: { inc: vi.fn() },
  importErrors: { inc: vi.fn() },
  setLastRunNow: vi.fn(),
  startImportTimer: vi.fn(() => endTimerSpy),
}));

vi.mock('../provenance.js', () => ({
  startImportRun: vi.fn(async () => ({ id: 'run-123' })),
  finishImportRun: vi.fn(async () => {}),
}));

vi.mock('../run-lock.js', () => ({
  acquireRunLock: vi.fn(async () => true),
  makeLockKey: vi.fn((meta: { importSource: string; job: string }) => `${meta.importSource}:${meta.job}`),
  releaseRunLock: vi.fn(async () => {}),
}));

describe('withRun', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    endTimerSpy.mockClear();

    vi.mocked(startImportRun).mockResolvedValue({ id: 'run-123' } as any);
    vi.mocked(acquireRunLock).mockResolvedValue(true);
  });

  it('success path: starts run, calls work, records metrics, finishes succeeded, returns payload', async () => {
    const ctx = { importSource: 'WITS' as const, job: 'JOB', params: { a: 1 } };
    const work = vi.fn(async (importId: string) => {
      expect(importId).toBe('run-123');
      return { inserted: 5, payload: { ok: true } };
    });

    const out = await withRun(ctx, work);

    expect(out).toEqual({ ok: true });

    expect(startImportTimer).toHaveBeenCalledWith({ importSource: 'WITS', job: 'JOB' });
    expect(acquireRunLock).toHaveBeenCalledWith('WITS:JOB');
    expect(startImportRun).toHaveBeenCalledWith({
      importSource: 'WITS',
      job: 'JOB',
      params: { a: 1 },
    });
    expect(importRowsInserted.inc).toHaveBeenCalledWith({ importSource: 'WITS', job: 'JOB' }, 5);
    expect(setLastRunNow).toHaveBeenCalledWith({ importSource: 'WITS', job: 'JOB' });
    expect(endTimerSpy).toHaveBeenCalledTimes(1);
    expect(finishImportRun).toHaveBeenCalledWith('run-123', {
      importStatus: 'succeeded',
      inserted: 5,
    });
    expect(releaseRunLock).toHaveBeenCalledWith('WITS:JOB');
  });

  it('defaults params to {} when absent', async () => {
    const ctx = { importSource: 'WITS' as const, job: 'B' };
    const work = vi.fn(async () => ({ inserted: 1, payload: 'x' }));

    await withRun(ctx, work);

    expect(startImportRun).toHaveBeenCalledWith({
      importSource: 'WITS',
      job: 'B',
      params: {},
    });
    expect(releaseRunLock).toHaveBeenCalledWith('WITS:B');
  });

  it('uses inserted=0 when work returns undefined inserted', async () => {
    const ctx = { importSource: 'WITS' as const, job: 'J' };

    // Cast to the signature that withRun expects (inserted: number)
    const work = vi.fn(async () => ({ inserted: undefined, payload: 42 })) as unknown as (
      importId: string
    ) => Promise<{ inserted: number; payload: number }>;

    const out = await withRun(ctx, work);

    expect(out).toBe(42);
    expect(importRowsInserted.inc).toHaveBeenCalledWith({ importSource: 'WITS', job: 'J' }, 0);
    expect(releaseRunLock).toHaveBeenCalledWith('WITS:J');
  });

  it('error path: records error metric, finishes failed, rethrows', async () => {
    const ctx = { importSource: 'WITS' as const, job: 'JOB' };
    const err = new Error('boom');
    const work = vi.fn(async () => {
      throw err;
    });

    await expect(withRun(ctx, work)).rejects.toThrow('boom');

    expect(endTimerSpy).toHaveBeenCalledTimes(1);

    expect(importErrors.inc).toHaveBeenCalledWith({
      importSource: 'WITS',
      job: 'JOB',
      stage: 'script',
    });
    expect(finishImportRun).toHaveBeenCalledWith('run-123', {
      importStatus: 'failed',
      error: 'boom',
    });

    expect(importRowsInserted.inc).not.toHaveBeenCalled();
    expect(setLastRunNow).not.toHaveBeenCalled();
    expect(releaseRunLock).toHaveBeenCalledWith('WITS:JOB');
  });

  it('lock-conflict path: records lock metric and fails before provenance', async () => {
    vi.mocked(acquireRunLock).mockResolvedValue(false);
    const ctx = { importSource: 'WITS' as const, job: 'LOCKED' };
    const work = vi.fn(async () => ({ inserted: 1, payload: 'x' }));

    await expect(withRun(ctx, work)).rejects.toThrow('Import already running for lock key: WITS:LOCKED');

    expect(startImportTimer).toHaveBeenCalledWith({ importSource: 'WITS', job: 'LOCKED' });
    expect(importErrors.inc).toHaveBeenCalledWith({
      importSource: 'WITS',
      job: 'LOCKED',
      stage: 'lock',
    });
    expect(startImportRun).not.toHaveBeenCalled();
    expect(work).not.toHaveBeenCalled();
    expect(releaseRunLock).not.toHaveBeenCalled();
    expect(endTimerSpy).toHaveBeenCalledTimes(1);
  });
});
