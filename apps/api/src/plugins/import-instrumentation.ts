import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import {
  importErrors,
  importRowsInserted,
  setLastRunNow,
  startImportTimer,
} from '../lib/metrics.js';
import { finishImportRun, heartBeatImportRun, startImportRun } from '../lib/provenance.js';
import { acquireRunLock, makeLockKey, releaseRunLock } from '../lib/run-lock.js'; // 👈 NEW

const plugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('importCtx', undefined);

  // Start timer + provenance if route declares config.importMeta
  app.addHook('preHandler', async (req, reply) => {
    const meta = req.routeOptions?.config?.importMeta;
    if (!meta) return;

    const cfg = req.routeOptions?.config;
    const custom =
      typeof cfg?.importLockKey === 'function' ? cfg.importLockKey(req) : cfg?.importLockKey;
    const lockKey = custom || makeLockKey(meta); // `${source}:${job}` by default

    const ok = await acquireRunLock(lockKey);
    if (!ok) {
      return reply.code(409).send({ error: 'import already running', lockKey });
    }

    // 3) start metrics + provenance
    const end = startImportTimer(meta);
    const run = await startImportRun({
      importSource: meta.importSource,
      job: meta.job,
      params: (req.body ?? {}) as Record<string, unknown>,
    });

    // 4) heartbeat every 30s so "stuck" runs can be detected
    const hb = setInterval(() => {
      heartBeatImportRun(run.id).catch(() => {});
    }, 30_000);
    hb.unref?.();

    req._importHeartbeat = hb;
    req.importCtx = { meta, runId: run.id, endTimer: end, lockKey };
  });

  function stopHeartbeat(req: any) {
    const hb = req?._importHeartbeat as NodeJS.Timeout | undefined;
    if (hb) clearInterval(hb);
    if (req) req._importHeartbeat = undefined;
  }

  // Finish on normal responses, infer {inserted|count} from JSON payload
  app.addHook('onSend', async (req, reply, payload) => {
    const ctx = req.importCtx;
    if (!ctx) return;

    try {
      let inserted = 0;
      const ct = String(reply.getHeader('content-type') ?? '');
      if (ct.includes('application/json') && payload && typeof payload !== 'function') {
        const s = Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload);
        try {
          const json = JSON.parse(s);
          inserted = Number(json?.inserted ?? json?.count ?? 0);
        } catch {
          /* ignore parse errors */
        }
      }

      const ok = reply.statusCode < 400;
      if (ok) {
        importRowsInserted.inc(ctx.meta, inserted);
        setLastRunNow(ctx.meta);
        await finishImportRun(ctx.runId, { importStatus: 'succeeded', inserted });
      } else {
        importErrors.inc({ ...ctx.meta, stage: 'response' });
        await finishImportRun(ctx.runId, {
          importStatus: 'failed',
          error: `HTTP ${reply.statusCode}`,
        });
      }
    } finally {
      ctx.endTimer();
      stopHeartbeat(req);
      if (ctx.lockKey) await releaseRunLock(ctx.lockKey);
      req.importCtx = undefined;
    }
  });

  app.addHook('onError', async (req, _reply, err) => {
    const ctx = req.importCtx;
    if (!ctx) return;
    importErrors.inc({ ...ctx.meta, stage: 'error' });
    await finishImportRun(ctx.runId, {
      importStatus: 'failed',
      error: String(err?.message ?? err),
    });
    ctx.endTimer();
    stopHeartbeat(req);
    if (ctx.lockKey) await releaseRunLock(ctx.lockKey);
    req.importCtx = undefined;
  });
};

export default fp(plugin, { name: 'import-instrumentation' });
