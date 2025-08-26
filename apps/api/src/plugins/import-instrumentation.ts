import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import {
  importErrors,
  importRowsInserted,
  setLastRunNow,
  startImportTimer,
} from '../lib/metrics.js';
import { finishImportRun, type ImportSource, startImportRun } from '../lib/provenance.js';

type ImportMeta = { source: ImportSource; job: string };
type ImportCtx = {
  meta: ImportMeta;
  runId: string;
  endTimer: () => void;
};

const plugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('importCtx', undefined as unknown as ImportCtx | undefined);

  app.addHook('preHandler', async (req) => {
    const meta = (req.routeOptions.config as { importMeta?: ImportMeta } | undefined)?.importMeta;
    if (!meta) return;

    const end = startImportTimer(meta);

    const params: Record<string, unknown> =
      req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};

    const run = await startImportRun({
      source: meta.source,
      job: meta.job,
      params,
    });

    req.importCtx = { meta, runId: run.id, endTimer: end };
  });

  app.addHook('onSend', async (req, reply, payload) => {
    const ctx = req.importCtx;
    if (!ctx) return;

    try {
      let inserted = 0;

      const ct = String(reply.getHeader('content-type') ?? '');
      if (ct.includes('application/json') && payload && typeof payload !== 'function') {
        if (typeof payload === 'string' || Buffer.isBuffer(payload)) {
          try {
            const json = JSON.parse(Buffer.isBuffer(payload) ? payload.toString('utf8') : payload);
            inserted = Number(json?.inserted ?? json?.count ?? 0);
          } catch {
            /* ignore parse errors */
          }
        } else if (typeof payload === 'object') {
          const anyJson = payload as Record<string, unknown>;
          inserted = Number((anyJson as any)?.inserted ?? (anyJson as any)?.count ?? 0);
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
      req.importCtx = undefined;
    }
  });

  app.addHook('onError', async (req, _reply, err) => {
    const ctx = req.importCtx;
    if (!ctx) return;
    importErrors.inc({ ...ctx.meta, stage: 'error' });
    await finishImportRun(ctx.runId, { status: 'failed', error: String(err?.message ?? err) });
    ctx.endTimer();
    req.importCtx = undefined;
  });
};

export default fp(plugin, { name: 'import-instrumentation' });
