import type { FastifyInstance } from 'fastify';
import { registry } from '../../lib/metrics.js';
import { resolveMetricsRequireSigning } from '../../lib/env.js';

export default function metricsRoutes(app: FastifyInstance) {
  // Prometheus scrape (protected)
  const requireSigning = resolveMetricsRequireSigning();
  app.get(
    '/metrics',
    {
      preHandler: app.requireApiKey(['ops:metrics'], { internalSigned: requireSigning }),
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (_req, reply) => {
      const body = await registry.metrics();
      reply.header('content-type', registry.contentType).header('cache-control', 'no-store');
      return reply.send(body);
    }
  );

  // GET already exposes HEAD automatically in Fastify.
}
