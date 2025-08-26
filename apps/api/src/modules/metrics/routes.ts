import type { FastifyInstance } from 'fastify';
import { registry } from '../../lib/metrics.js';

export default function metricsRoutes(app: FastifyInstance) {
  app.get('/metrics', async (_req, reply) => {
    // If you want to guard, replace with your admin guard (or IP filter)
    reply.header('Content-Type', registry.contentType);
    return reply.send(await registry.metrics());
  });
}
