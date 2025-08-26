import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { apiUsageTable, db } from '@clearcost/db';
import { sql } from 'drizzle-orm';

function dayStartUTC(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export default fp(
  async function usagePlugin(app: FastifyInstance) {
    app.decorateRequest('_usage', undefined);

    app.addHook('onRequest', async (req) => {
      const bytesIn = Number(req.headers['content-length'] || 0);
      req._usage = { start: Date.now(), bytesIn, bytesOut: 0 };
    });

    app.addHook('onSend', async (req, _reply, payload) => {
      if (!req._usage) req._usage = { start: Date.now(), bytesIn: 0, bytesOut: 0 };
      if (typeof payload === 'string') req._usage.bytesOut = Buffer.byteLength(payload);
      else if (Buffer.isBuffer(payload)) req._usage.bytesOut = payload.length;
    });

    app.addHook('onResponse', async (req, reply) => {
      try {
        const apiKeyId = req.apiKey?.id;
        if (!apiKeyId) return;

        const u = req._usage!;
        const duration = Math.max(0, Date.now() - u.start);

        const day = dayStartUTC();
        const route =
          (req.routeOptions && typeof req.routeOptions.url === 'string'
            ? req.routeOptions.url
            : req.raw.url?.split('?')[0]) ?? 'unknown';

        const method = req.method;

        await db
          .insert(apiUsageTable)
          .values({
            apiKeyId,
            day,
            route,
            method,
            count: 1,
            sumDurationMs: duration,
            sumBytesIn: u.bytesIn || 0,
            sumBytesOut: u.bytesOut || 0,
            lastAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [
              apiUsageTable.apiKeyId,
              apiUsageTable.day,
              apiUsageTable.route,
              apiUsageTable.method,
            ],
            set: {
              count: sql`${apiUsageTable.count} + 1`,
              sumDurationMs: sql`${apiUsageTable.sumDurationMs} + ${duration}`,
              sumBytesIn: sql`${apiUsageTable.sumBytesIn} + ${u.bytesIn || 0}`,
              sumBytesOut: sql`${apiUsageTable.sumBytesOut} + ${u.bytesOut || 0}`,
              lastAt: new Date(),
              updatedAt: new Date(),
            },
          });
      } catch (err) {
        req.log.warn({ err }, 'usage metering failed');
      }
    });
  },
  { name: 'usage-plugin' }
);
