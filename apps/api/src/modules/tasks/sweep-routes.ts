import { FastifyInstance } from 'fastify';
import { sweepStaleImports } from '../../lib/sweep-stale-imports.js';
import { TasksSweepStaleBodySchema } from '@clearcost/types';

export default function sweepRoutes(app: FastifyInstance) {
  const Body = TasksSweepStaleBodySchema;

  app.post(
    '/cron/imports/sweep-stale',
    {
      preHandler: app.requireApiKey(['tasks:ops:sweep-stale']),
      config: { importMeta: { importSource: 'MANUAL', job: 'ops:sweep-stale' } },
      schema: { body: Body.optional() },
    },
    async (req, reply) => {
      const { thresholdMinutes, limit } = Body.parse(req.body ?? {});
      const res = await sweepStaleImports({ thresholdMinutes, limit });

      // best-effort metric
      app.importsSwept?.inc(res.swept);

      return reply.send(res);
    }
  );
}
