import type { FastifyInstance } from 'fastify';
import { registry } from '../../lib/metrics.js';

export default function metricsRoutes(app: FastifyInstance) {
  // Prometheus scrape (protected)
  app.get(
    '/metrics',
    {
      preHandler: app.requireApiKey(['ops:metrics']),
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (_req, reply) => {
      const body = await registry.metrics();
      reply.header('content-type', registry.contentType).header('cache-control', 'no-store');
      return reply.send(body);
    }
  );

  // HEAD variant (auth + quick check)
  app.head(
    '/metrics',
    {
      preHandler: app.requireApiKey(['ops:metrics']),
      config: { rateLimit: { max: 300, timeWindow: '1 minute' } },
    },
    async (_req, reply) => {
      reply.header('content-type', registry.contentType).header('cache-control', 'no-store');
      return reply.send();
    }
  );
}
