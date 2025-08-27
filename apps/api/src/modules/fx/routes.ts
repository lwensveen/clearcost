import type { FastifyInstance } from 'fastify';
import { refreshFx } from '../../lib/refresh-fx.js';

export default function fxRoutes(app: FastifyInstance) {
  // POST /v1/fx/refresh  (requires API key with fx:write or admin scope)
  app.post(
    '/refresh',
    {
      preHandler: app.requireApiKey(['fx:write']),
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              base: { type: 'string' },
              fxAsOf: { type: 'string' },
              attemptedInserts: { type: 'number' },
            },
          },
        },
      },
    },
    async (_req, reply) => {
      const r = await refreshFx();
      return reply.send({ base: r.base, fxAsOf: r.fxAsOf, attemptedInserts: r.inserted });
    }
  );
}
