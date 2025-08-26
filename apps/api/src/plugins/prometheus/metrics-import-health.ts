import fp from 'fastify-plugin';
import { Gauge } from 'prom-client';
import { db, provenanceTable } from '@clearcost/db';
import { isNotNull, sql } from 'drizzle-orm';

export default fp(async (app) => {
  const lastRun = new Gauge({
    name: 'clearcost_import_last_run_timestamp',
    help: 'UNIX seconds of last provenance row per import id',
    labelNames: ['import_id'] as const,
  });

  app.addHook('onReady', async () => {
    const update = async () => {
      const rows = await db
        .select({
          import_id: provenanceTable.importId,
          last_at: sql<Date>`max(${provenanceTable.createdAt})`,
        })
        .from(provenanceTable)
        .where(isNotNull(provenanceTable.importId))
        .groupBy(provenanceTable.importId);

      lastRun.reset();
      for (const r of rows) {
        const ts = Math.floor(r.last_at.getTime() / 1000);
        lastRun.set({ import_id: r.import_id }, ts);
      }
    };

    await update();
    setInterval(update, 60_000).unref();
  });
});
