import type { FastifyInstance } from 'fastify';
import { checkHealth, HealthSchema } from './services.js';

export default function healthRoutes(app: FastifyInstance) {
  app.get(
    '/healthz',
    { schema: { response: { 200: HealthSchema, 503: HealthSchema } } },
    async (_req, reply) => {
      const report = await checkHealth();
      return reply.code(report.ok ? 200 : 503).send(report);
    }
  );

  app.head('/healthz', async (_req, reply) => {
    const report = await checkHealth();
    return reply.code(report.ok ? 200 : 503).send();
  });

  app.get(
    '/health',
    { schema: { response: { 200: HealthSchema, 503: HealthSchema } } },
    async (_req, reply) => {
      const report = await checkHealth();
      return reply.code(report.ok ? 200 : 503).send(report);
    }
  );
}
