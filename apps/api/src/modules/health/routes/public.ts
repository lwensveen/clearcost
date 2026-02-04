import type { FastifyInstance } from 'fastify';
import { checkHealth, HealthSchema } from '../services.js';

export default function healthPublicRoutes(app: FastifyInstance) {
  // Simple liveness (public)
  app.get(
    '/healthz',
    {
      schema: { response: { 200: HealthSchema, 503: HealthSchema } },
      config: { rateLimit: { max: 600, timeWindow: '1 minute' } },
    },
    async (_req, reply) => {
      const report = await checkHealth({ publicView: true });
      reply.header('cache-control', 'no-store');
      return reply.code(report.ok ? 200 : 503).send(report);
    }
  );

  // Readiness/details (public summary)
  app.get(
    '/health',
    {
      schema: { response: { 200: HealthSchema, 503: HealthSchema } },
      config: { rateLimit: { max: 300, timeWindow: '1 minute' } },
    },
    async (_req, reply) => {
      const report = await checkHealth({ publicView: true });
      reply.header('cache-control', 'no-store');
      return reply.code(report.ok ? 200 : 503).send(report);
    }
  );
}
