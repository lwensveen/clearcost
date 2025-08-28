import fp from 'fastify-plugin';
import { Gauge } from 'prom-client';
import { db, importsTable } from '@clearcost/db';
import { eq } from 'drizzle-orm';

export default fp(async (app) => {
  // override with IMPORT_AGE_BUCKETS="5,15,30,60,120,240"
  const edges = (process.env.IMPORT_AGE_BUCKETS ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b) || [5, 15, 30, 60, 120, 240];

  const bucketLabels = [
    `<${edges[0]}m`,
    ...edges.slice(1).map((e, i) => `${edges[i]}-${e}m`),
    `>${edges[edges.length - 1]}m`,
  ];

  const runningGauge = new Gauge({
    name: 'clearcost_imports_running',
    help: 'Count of running imports by age bucket (minutes since last heartbeat/updated_at).',
    labelNames: ['age_bucket'] as const,
  });

  async function update() {
    const rows = await db
      .select({ updatedAt: importsTable.updatedAt })
      .from(importsTable)
      .where(eq(importsTable.importStatus, 'running'));

    const items = rows as Array<{ updatedAt: Date | string }>;
    const now = Date.now();
    const counts = new Array(bucketLabels.length).fill(0) as number[];

    for (const r of items) {
      const t = new Date(r.updatedAt).getTime();
      const ageMin = (now - t) / 60000;
      let idx = edges.findIndex((edge) => ageMin < edge);
      if (idx === -1) idx = edges.length;
      counts[idx]! += 1;
    }

    for (let i = 0; i < bucketLabels.length; i++) {
      runningGauge.set({ age_bucket: bucketLabels[i]! }, counts[i]!);
    }
  }

  app.addHook('onReady', async () => {
    await update();
    setInterval(update, 60_000).unref();
  });
});
