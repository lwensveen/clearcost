import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import {
  importErrors,
  importRowsInserted,
  setLastRunNow,
  startImportTimer,
} from '../lib/metrics.js';
import { finishImportRun, heartBeatImportRun, startImportRun } from '../lib/provenance.js';

const plugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('importCtx', undefined);

  // Start timer + provenance if route declares config.importMeta
  app.addHook('preHandler', async (req) => {
    const meta = req.routeOptions?.config?.importMeta;
    if (!meta) return;

    const end = startImportTimer(meta);
    const run = await startImportRun({
      source: meta.source,
      job: meta.job,
      params: (req.body ?? {}) as Record<string, unknown>,
    });

    // heartbeat every 30s so "stuck" runs can be detected
    const hb = setInterval(() => {
      heartBeatImportRun(run.id).catch(() => {});
    }, 30_000);
    hb.unref?.();

    req._importHeartbeat = hb;
    req.importCtx = { meta, runId: run.id, endTimer: end };
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
        await finishImportRun(ctx.runId, { status: 'succeeded', inserted });
      } else {
        importErrors.inc({ ...ctx.meta, stage: 'response' });
        await finishImportRun(ctx.runId, {
          status: 'failed',
          error: `HTTP ${reply.statusCode}`,
        });
      }
    } finally {
      ctx.endTimer();
      stopHeartbeat(req);
      req.importCtx = undefined;
    }
  });

  // Ensure failure paths still close provenance + timer
  app.addHook('onError', async (req, _reply, err) => {
    const ctx = req.importCtx;
    if (!ctx) return;
    importErrors.inc({ ...ctx.meta, stage: 'error' });
    await finishImportRun(ctx.runId, {
      status: 'failed',
      error: String(err?.message ?? err),
    });
    ctx.endTimer();
    stopHeartbeat(req);
    req.importCtx = undefined;
  });
};

export default fp(plugin, { name: 'import-instrumentation' });
