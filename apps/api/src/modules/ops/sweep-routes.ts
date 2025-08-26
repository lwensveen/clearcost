import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { adminGuard } from '../tasks/common.js';
import { sweepStaleImports } from '../../lib/sweep-stale-imports.js';

export default function sweepRoutes(app: FastifyInstance) {
  const Body = z.object({
    thresholdMinutes: z.coerce
      .number()
      .int()
      .min(1)
      .max(24 * 60)
      .optional(),
    limit: z.coerce.number().int().min(1).max(10_000).optional(),
  });

  app.post(
    '/internal/cron/imports/sweep-stale',
    {
      preHandler: adminGuard,
      config: { importMeta: { source: 'MANUAL', job: 'ops:sweep-stale' } },
      schema: { body: Body.optional() },
    },
    async (req, reply) => {
      const { thresholdMinutes, limit } = Body.parse(req.body ?? {});

      const res = await sweepStaleImports({ thresholdMinutes, limit });

      app.importsSwept?.inc(res.swept);

      return reply.send(res);
    }
  );
}
