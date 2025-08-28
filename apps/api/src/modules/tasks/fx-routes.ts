import { FastifyInstance } from 'fastify';
import { refreshFx } from '../../lib/refresh-fx.js';

export default function fxRoutes(app: FastifyInstance) {
  // FX: refresh daily (ECB primary + optional secondary fill)
  app.post(
    '/internal/cron/fx/daily',
    {
      preHandler: app.requireApiKey(['tasks:fx:daily']),
      config: { importMeta: { importSource: 'ECB', job: 'fx:daily' } },
    },
    async (_req, reply) => {
      const { base, fxAsOf, inserted } = await refreshFx();
      return reply.send({ base, fxAsOf, inserted });
    }
  );
}
