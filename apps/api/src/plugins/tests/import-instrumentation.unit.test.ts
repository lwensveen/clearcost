import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { errorResponseForStatus } from '../../lib/errors.js';
// Import the mocked modules so our expectations reference the same instances
import {
  importErrors,
  importRowsInserted,
  setLastRunNow,
  startImportTimer,
} from '../../lib/metrics.js';
import { finishImportRun, heartBeatImportRun, startImportRun } from '../../lib/provenance.js';

// ---------------- Hoisted state ----------------
const { acquireRunLockMock, releaseRunLockMock, makeLockKeyMock, endTimerSpy } = vi.hoisted(() => {
  return {
    acquireRunLockMock: vi.fn(async () => true),
    releaseRunLockMock: vi.fn(async () => {}),
    makeLockKeyMock: vi.fn((meta: any) => `${meta.importSource}:${meta.job}`),
    endTimerSpy: vi.fn(),
  };
});

// ---------------- Mocks (note the ../../lib paths) ----------------
vi.mock('../../lib/metrics.js', () => ({
  importRowsInserted: { inc: vi.fn() },
  importErrors: { inc: vi.fn() },
  startImportTimer: vi.fn(() => endTimerSpy),
  setLastRunNow: vi.fn(),
}));

vi.mock('../../lib/provenance.js', () => ({
  startImportRun: vi.fn(async () => ({ id: 'run-1' })),
  heartBeatImportRun: vi.fn(async () => {}),
  finishImportRun: vi.fn(async () => {}),
}));

vi.mock('../../lib/run-lock.js', () => ({
  acquireRunLock: acquireRunLockMock,
  releaseRunLock: releaseRunLockMock,
  makeLockKey: makeLockKeyMock,
}));

// Dynamically import the SUT AFTER mocks are applied
async function loadPlugin() {
  const mod = await import('../import-instrumentation.js');
  return mod.default as (typeof import('../import-instrumentation.js'))['default'];
}

// Helpers
function jsonCT(headers: Record<string, string> = {}) {
  return { ...headers, 'content-type': 'application/json' };
}

describe('import-instrumentation plugin (unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    endTimerSpy.mockClear();
    acquireRunLockMock.mockResolvedValue(true);
    makeLockKeyMock.mockImplementation((meta: any) => `${meta.importSource}:${meta.job}`);
  });

  it('no-op when route has no config.importMeta', async () => {
    const plugin = await loadPlugin();
    const app = Fastify();
    await app.register(plugin);
    app.get('/noop', async () => ({ ok: true }));

    const res = await app.inject({ method: 'GET', url: '/noop' });
    expect(res.statusCode).toBe(200);
    expect(acquireRunLockMock).not.toHaveBeenCalled();
    expect(startImportTimer).not.toHaveBeenCalled();
    expect(startImportRun).not.toHaveBeenCalled();
    await app.close();
  });

  it('returns 409 when lock cannot be acquired and includes lockKey', async () => {
    acquireRunLockMock.mockResolvedValue(false);

    const plugin = await loadPlugin();
    const app = Fastify();
    await app.register(plugin);
    app.post(
      '/imp',
      { config: { importMeta: { importSource: 'WITS', job: 'seed' } } },
      async (_req, reply) => reply.send({ inserted: 1 })
    );

    const r = await app.inject({ method: 'POST', url: '/imp', headers: jsonCT(), payload: '{}' });
    expect(r.statusCode).toBe(409);
    expect(r.json()).toMatchObject({
      error: { message: 'import already running', details: { lockKey: 'WITS:seed' } },
    });

    expect(acquireRunLockMock).toHaveBeenCalledWith('WITS:seed');
    expect(startImportTimer).not.toHaveBeenCalled();
    expect(startImportRun).not.toHaveBeenCalled();
    expect(releaseRunLockMock).not.toHaveBeenCalled();
    await app.close();
  });

  it('uses default lock key via makeLockKey; releases it on success', async () => {
    const plugin = await loadPlugin();
    const app = Fastify();
    await app.register(plugin);
    app.post(
      '/imp',
      { config: { importMeta: { importSource: 'WITS', job: 'seed' } } },
      async (_req, reply) => reply.type('application/json').send({ inserted: 3 })
    );

    const r = await app.inject({ method: 'POST', url: '/imp' });
    expect(r.statusCode).toBe(200);

    expect(makeLockKeyMock).toHaveBeenCalledWith({ importSource: 'WITS', job: 'seed' });
    expect(acquireRunLockMock).toHaveBeenCalledWith('WITS:seed');
    expect(importRowsInserted.inc).toHaveBeenCalledWith({ importSource: 'WITS', job: 'seed' }, 3);
    expect(setLastRunNow).toHaveBeenCalledWith({ importSource: 'WITS', job: 'seed' });
    expect(finishImportRun).toHaveBeenCalledWith('run-1', {
      importStatus: 'succeeded',
      inserted: 3,
    });
    expect(endTimerSpy).toHaveBeenCalledTimes(1);
    expect(releaseRunLockMock).toHaveBeenCalledWith('WITS:seed');
    await app.close();
  });

  it('records sourceUrl/version provenance from query or meta when starting a run', async () => {
    const plugin = await loadPlugin();
    const app = Fastify();
    await app.register(plugin);
    app.post(
      '/imp',
      {
        config: {
          importMeta: {
            importSource: 'MANUAL',
            job: 'duties:json',
            sourceUrl: 'https://meta.example/source.csv',
            version: 'meta-v1',
          },
        },
      },
      async (_req, reply) => reply.type('application/json').send({ inserted: 1 })
    );

    const r = await app.inject({
      method: 'POST',
      url: '/imp?source=https%3A%2F%2Fquery.example%2Foverride.csv&version=query-v2',
      headers: jsonCT(),
      payload: JSON.stringify({ source: 'body-source', version: 'body-v3' }),
    });
    expect(r.statusCode).toBe(200);

    expect(startImportRun).toHaveBeenCalledWith({
      importSource: 'MANUAL',
      job: 'duties:json',
      sourceUrl: 'https://meta.example/source.csv',
      version: 'meta-v1',
      params: {
        query: {
          source: 'https://query.example/override.csv',
          version: 'query-v2',
        },
        body: {
          source: 'body-source',
          version: 'body-v3',
        },
      },
    });
    await app.close();
  });

  it('supports custom importLockKey (string and function)', async () => {
    // string key
    {
      const plugin = await loadPlugin();
      const app = Fastify();
      await app.register(plugin);
      app.post(
        '/imp1',
        {
          config: {
            importMeta: { importSource: 'WITS', job: 'A' },
            importLockKey: 'custom:lock',
          },
        },
        async (_req, reply) => reply.type('application/json').send({ inserted: 1 })
      );
      const r1 = await app.inject({ method: 'POST', url: '/imp1' });
      expect(r1.statusCode).toBe(200);
      expect(acquireRunLockMock).toHaveBeenCalledWith('custom:lock');
      expect(releaseRunLockMock).toHaveBeenCalledWith('custom:lock');
      await app.close();
    }

    // function key
    {
      const plugin = await loadPlugin();
      const app = Fastify();
      await app.register(plugin);
      app.post(
        '/imp2',
        {
          config: {
            importMeta: { importSource: 'WITS', job: 'B' },
            importLockKey: (req: any) => `fn:${(req.body?.tenant as string) || 'na'}`,
          },
        },
        async (_req, reply) => reply.type('application/json').send({ count: 2 })
      );
      const r2 = await app.inject({
        method: 'POST',
        url: '/imp2',
        payload: { tenant: 't1' },
        headers: jsonCT(),
      });
      expect(r2.statusCode).toBe(200);
      expect(acquireRunLockMock).toHaveBeenCalledWith('fn:t1');
      expect(importRowsInserted.inc).toHaveBeenCalledWith({ importSource: 'WITS', job: 'B' }, 2);
      expect(releaseRunLockMock).toHaveBeenCalledWith('fn:t1');
      await app.close();
    }
  });

  it('treats non-JSON response as inserted=0 but still succeeds', async () => {
    const plugin = await loadPlugin();
    const app = Fastify();
    await app.register(plugin);
    app.get(
      '/txt',
      { config: { importMeta: { importSource: 'WITS', job: 'seed' } } },
      async (_req, reply) => reply.type('text/plain').send('ok')
    );

    const r = await app.inject({ method: 'GET', url: '/txt' });
    expect(r.statusCode).toBe(200);

    expect(importRowsInserted.inc).toHaveBeenCalledWith({ importSource: 'WITS', job: 'seed' }, 0);
    expect(finishImportRun).toHaveBeenCalledWith('run-1', {
      importStatus: 'succeeded',
      inserted: 0,
    });
    expect(releaseRunLockMock).toHaveBeenCalledWith('WITS:seed');
    await app.close();
  });

  it('failure response (>=400) increments error metric and finishes as failed', async () => {
    const plugin = await loadPlugin();
    const app = Fastify();
    await app.register(plugin);
    app.get(
      '/fail',
      { config: { importMeta: { importSource: 'WITS', job: 'seed' } } },
      async (_req, reply) =>
        reply.code(500).type('application/json').send(errorResponseForStatus(500, 'boom'))
    );

    const r = await app.inject({ method: 'GET', url: '/fail' });
    expect(r.statusCode).toBe(500);

    expect(importErrors.inc).toHaveBeenCalledWith({
      importSource: 'WITS',
      job: 'seed',
      stage: 'response',
    });
    expect(finishImportRun).toHaveBeenCalledWith('run-1', {
      importStatus: 'failed',
      error: 'HTTP 500',
    });
    expect(endTimerSpy).toHaveBeenCalledTimes(1);
    expect(releaseRunLockMock).toHaveBeenCalledWith('WITS:seed');
    await app.close();
  });

  it('onError path: thrown error increments error metric, finishes failed, releases lock', async () => {
    const plugin = await loadPlugin();
    const app = Fastify();
    await app.register(plugin);
    app.get(
      '/throw',
      { config: { importMeta: { importSource: 'WITS', job: 'seed' } } },
      async () => {
        throw new Error('kaboom');
      }
    );

    const r = await app.inject({ method: 'GET', url: '/throw' });
    expect(r.statusCode).toBe(500);

    expect(importErrors.inc).toHaveBeenCalledWith({
      importSource: 'WITS',
      job: 'seed',
      stage: 'error',
    });
    expect(finishImportRun).toHaveBeenCalledWith('run-1', {
      importStatus: 'failed',
      error: 'kaboom',
    });
    expect(endTimerSpy).toHaveBeenCalledTimes(1);
    expect(releaseRunLockMock).toHaveBeenCalledWith('WITS:seed');
    await app.close();
  });

  it('releases lock and records start-stage error when startImportRun fails in preHandler', async () => {
    vi.mocked(startImportRun).mockRejectedValueOnce(new Error('db unavailable'));

    const plugin = await loadPlugin();
    const app = Fastify();
    await app.register(plugin);
    app.post(
      '/start-fail',
      { config: { importMeta: { importSource: 'WITS', job: 'seed' } } },
      async (_req, reply) => reply.type('application/json').send({ inserted: 1 })
    );

    const r = await app.inject({
      method: 'POST',
      url: '/start-fail',
      headers: jsonCT(),
      payload: '{}',
    });
    expect(r.statusCode).toBe(500);

    expect(startImportRun).toHaveBeenCalledTimes(1);
    expect(importErrors.inc).toHaveBeenCalledWith({
      importSource: 'WITS',
      job: 'seed',
      stage: 'start',
    });
    expect(endTimerSpy).toHaveBeenCalledTimes(1);
    expect(releaseRunLockMock).toHaveBeenCalledWith('WITS:seed');
    expect(finishImportRun).not.toHaveBeenCalled();
    await app.close();
  });

  it('onError string throw uses string fallback in provenance error text', async () => {
    const plugin = await loadPlugin();
    const app = Fastify();
    await app.register(plugin);
    app.get(
      '/throw-string',
      { config: { importMeta: { importSource: 'WITS', job: 'seed' } } },
      async () => {
        throw 'kaboom-string';
      }
    );

    const r = await app.inject({ method: 'GET', url: '/throw-string' });
    expect(r.statusCode).toBe(500);
    expect(finishImportRun).toHaveBeenCalledWith('run-1', {
      importStatus: 'failed',
      error: 'kaboom-string',
    });
    await app.close();
  });

  it('onError with empty lock key does not call releaseRunLock', async () => {
    makeLockKeyMock.mockReturnValueOnce('');

    const plugin = await loadPlugin();
    const app = Fastify();
    await app.register(plugin);
    app.get(
      '/throw-empty-lock',
      { config: { importMeta: { importSource: 'WITS', job: 'seed' } } },
      async () => {
        throw new Error('boom-empty-lock');
      }
    );

    const r = await app.inject({ method: 'GET', url: '/throw-empty-lock' });
    expect(r.statusCode).toBe(500);
    expect(releaseRunLockMock).not.toHaveBeenCalled();
    await app.close();
  });

  it('heartbeats fire while handler is in-flight (interval every 30s)', async () => {
    vi.useFakeTimers();

    const plugin = await loadPlugin();
    const app = Fastify();
    await app.register(plugin);

    // Slow route we can control with a deferred
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));

    app.post(
      '/slow',
      { config: { importMeta: { importSource: 'WITS', job: 'seed' } } },
      async (_req, reply) => {
        await gate; // wait until test advances timers
        return reply.type('application/json').send({ inserted: 1 });
      }
    );

    const reqP = app.inject({ method: 'POST', url: '/slow', headers: jsonCT(), payload: '{}' });

    // Advance fake timers to trigger heartbeats (30s interval)
    await vi.advanceTimersByTimeAsync(30_000);
    expect(heartBeatImportRun).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(heartBeatImportRun).toHaveBeenCalledTimes(2);

    // Let handler finish
    release();
    const res = await reqP;
    expect(res.statusCode).toBe(200);

    // After finish, heartbeat should stop; advancing more time should NOT add calls
    await vi.advanceTimersByTimeAsync(90_000);
    expect(heartBeatImportRun).toHaveBeenCalledTimes(2);

    expect(releaseRunLockMock).toHaveBeenCalledWith('WITS:seed');
    await app.close();

    vi.useRealTimers();
  });

  it('parses JSON payload string when reply already serialized', async () => {
    const plugin = await loadPlugin();
    const app = Fastify();
    await app.register(plugin);
    app.get(
      '/serialized',
      { config: { importMeta: { importSource: 'WITS', job: 'seed' } } },
      async (_req, reply) => reply.type('application/json').send('{"inserted":5}')
    );

    const r = await app.inject({ method: 'GET', url: '/serialized' });
    expect(r.statusCode).toBe(200);
    expect(importRowsInserted.inc).toHaveBeenCalledWith({ importSource: 'WITS', job: 'seed' }, 5);
    await app.close();
  });

  it('records updated row counts when payload includes inserted and updated', async () => {
    const plugin = await loadPlugin();
    const app = Fastify();
    await app.register(plugin);
    app.get(
      '/with-updated',
      { config: { importMeta: { importSource: 'WITS', job: 'seed' } } },
      async (_req, reply) =>
        reply.type('application/json').send({ inserted: 2, updated: 5, count: 7 })
    );

    const r = await app.inject({ method: 'GET', url: '/with-updated' });
    expect(r.statusCode).toBe(200);
    expect(importRowsInserted.inc).toHaveBeenCalledWith({ importSource: 'WITS', job: 'seed' }, 2);
    expect(finishImportRun).toHaveBeenCalledWith('run-1', {
      importStatus: 'succeeded',
      inserted: 2,
      updated: 5,
    });
    await app.close();
  });

  it('includes runPatch artifact fields when finishing a successful import', async () => {
    const plugin = await loadPlugin();
    const app = Fastify();
    await app.register(plugin);
    app.get(
      '/artifact',
      { config: { importMeta: { importSource: 'WITS', job: 'seed' } } },
      async (req, reply) => {
        req.importCtx!.runPatch = {
          ...req.importCtx!.runPatch,
          sourceUrl: 'https://example.test/data.json',
          fileHash: 'abc123',
          fileBytes: 42,
        };
        return reply.type('application/json').send({ inserted: 1 });
      }
    );

    const r = await app.inject({ method: 'GET', url: '/artifact' });
    expect(r.statusCode).toBe(200);
    expect(finishImportRun).toHaveBeenCalledWith('run-1', {
      importStatus: 'succeeded',
      inserted: 1,
      sourceUrl: 'https://example.test/data.json',
      fileHash: 'abc123',
      fileBytes: 42,
    });
    await app.close();
  });

  it('ignores invalid JSON body safely (inserted defaults to 0)', async () => {
    const plugin = await loadPlugin();
    const app = Fastify();
    await app.register(plugin);
    app.get(
      '/badjson',
      { config: { importMeta: { importSource: 'WITS', job: 'seed' } } },
      async (_req, reply) => reply.type('application/json').send('not-json')
    );

    const r = await app.inject({ method: 'GET', url: '/badjson' });
    expect(r.statusCode).toBe(200);
    expect(importRowsInserted.inc).toHaveBeenCalledWith({ importSource: 'WITS', job: 'seed' }, 0);
    await app.close();
  });

  it('parses JSON from Buffer payloads', async () => {
    const plugin = await loadPlugin();
    const app = Fastify();
    await app.register(plugin);
    app.get(
      '/buffer-json',
      { config: { importMeta: { importSource: 'WITS', job: 'seed' } } },
      async (_req, reply) =>
        reply.type('application/json').send(Buffer.from(JSON.stringify({ inserted: 4 })))
    );

    const r = await app.inject({ method: 'GET', url: '/buffer-json' });
    expect(r.statusCode).toBe(200);
    expect(importRowsInserted.inc).toHaveBeenCalledWith({ importSource: 'WITS', job: 'seed' }, 4);
    await app.close();
  });

  it('skips lock release when lock key is empty string', async () => {
    makeLockKeyMock.mockReturnValueOnce('');

    const plugin = await loadPlugin();
    const app = Fastify();
    await app.register(plugin);
    app.get(
      '/empty-lock',
      { config: { importMeta: { importSource: 'WITS', job: 'seed' } } },
      async (_req, reply) => reply.type('application/json').send({ inserted: 1 })
    );

    const r = await app.inject({ method: 'GET', url: '/empty-lock' });
    expect(r.statusCode).toBe(200);
    expect(acquireRunLockMock).toHaveBeenCalledWith('');
    expect(releaseRunLockMock).not.toHaveBeenCalled();
    await app.close();
  });

  it('returns early in onError when route has no importMeta context', async () => {
    const plugin = await loadPlugin();
    const app = Fastify();
    await app.register(plugin);
    app.get('/plain-throw', async () => {
      throw new Error('plain-error');
    });

    const r = await app.inject({ method: 'GET', url: '/plain-throw' });
    expect(r.statusCode).toBe(500);
    expect(importErrors.inc).not.toHaveBeenCalled();
    expect(finishImportRun).not.toHaveBeenCalled();
    await app.close();
  });

  it('handles missing heartbeat handle without crashing stopHeartbeat', async () => {
    const plugin = await loadPlugin();
    const app = Fastify();
    await app.register(plugin);
    app.get(
      '/no-heartbeat',
      { config: { importMeta: { importSource: 'WITS', job: 'seed' } } },
      async (req, reply) => {
        (req as any)._importHeartbeat = undefined;
        return reply.type('application/json').send({ inserted: 1 });
      }
    );

    const r = await app.inject({ method: 'GET', url: '/no-heartbeat' });
    expect(r.statusCode).toBe(200);
    expect(releaseRunLockMock).toHaveBeenCalledWith('WITS:seed');
    await app.close();
  });
});
