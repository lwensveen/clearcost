import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { adminGuard } from './common.js';
import { importDeMinimisFromZonos } from '../de-minimis/services/import-from-zonos.js';

export default function deMinimisTaskRoutes(app: FastifyInstance) {
  const Body = z.object({
    effectiveOn: z.coerce.date().optional(),
  });

  app.post<{ Body: z.infer<typeof Body> }>(
    '/internal/cron/de-minimis/import-zonos',
    {
      preHandler: adminGuard,
      config: { importMeta: { source: 'ZONOS', job: 'de-minimis:import-zonos' } },
      schema: { body: Body },
    },
    async (req, reply) => {
      const { effectiveOn } = Body.parse(req.body ?? {});
      const eff = effectiveOn ?? new Date();

      const result = importDeMinimisFromZonos(eff);

      return reply.send(result);
    }
  );
}
