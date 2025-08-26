import { FastifyInstance } from 'fastify';
import { refreshFx } from '../../lib/refresh-fx.js';
import { adminGuard } from './common.js';

export default function fxRoutes(app: FastifyInstance) {
  // FX: refresh daily (ECB primary + optional secondary fill)
  app.post(
    '/internal/cron/fx/daily',
    {
      preHandler: adminGuard,
      config: { importMeta: { source: 'ECB', job: 'fx:daily' } },
    },
    async (_req, reply) => {
      const inserted = await refreshFx();
      return reply.send({ ok: true, inserted });
    }
  );
}
