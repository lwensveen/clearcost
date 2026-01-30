import fp from 'fastify-plugin';
import { Gauge } from 'prom-client';
import { registry } from '../../lib/metrics.js';
import { db, provenanceTable } from '@clearcost/db';
import { isNotNull, sql } from 'drizzle-orm';

function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v == null) return new Date(0);
  return new Date(String(v));
}

export default fp(async (app) => {
  const lastRun = new Gauge({
    name: 'clearcost_import_last_run_timestamp',
    help: 'UNIX seconds of last provenance row per import id',
    labelNames: ['import_id'] as const,
    registers: [registry],
  });

  let timer: NodeJS.Timer | undefined;

  const update = async () => {
    try {
      const rows = await db
        .select({
          import_id: provenanceTable.importId,
          last_at: sql<string>`max(${provenanceTable.createdAt})`,
        })
        .from(provenanceTable)
        .where(isNotNull(provenanceTable.importId))
        .groupBy(provenanceTable.importId);

      lastRun.reset();
      for (const r of rows) {
        const last = toDate(r.last_at);
        const ts = Math.floor(last.getTime() / 1000);
        lastRun.set({ import_id: r.import_id }, ts);
      }
    } catch (err) {
      app.log.warn({ err }, 'failed to update import last-run gauges');
    }
  };

  app.addHook('onReady', async () => {
    await update();
    timer = setInterval(update, 60_000);
    timer.unref?.();
  });

  app.addHook('onClose', async () => {
    if (timer) clearInterval(timer);
  });
});
