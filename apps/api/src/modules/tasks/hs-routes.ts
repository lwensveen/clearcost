import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { adminGuard } from './common.js';
import { importEuHs6FromTaric } from '../hs-codes/services/aliases/eu/import-cn6-from-taric.js';
import { importAhtnAliases } from '../hs-codes/services/aliases/import-ahtn.js';

export default function hsRoutes(app: FastifyInstance) {
  // EU HS6 from TARIC
  app.post(
    '/internal/cron/import/hs/eu-hs6',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      config: { importMeta: { source: 'TARIC', job: 'hs:eu-hs6' } },
    },
    async (req, reply) => {
      const importId = (req as any).importRunId as string | undefined;
      const res = await importEuHs6FromTaric({ importId });
      return reply.send(res);
    }
  );

  // ASEAN AHTN aliases
  app.post(
    '/internal/cron/import/hs/ahtn',
    {
      preHandler: adminGuard,
      config: { importMeta: { source: 'AHTN', job: 'hs:ahtn' } },
    },
    async (req, reply) => {
      const Body = z.object({
        url: z.string().url().optional(),
        batchSize: z.coerce.number().int().min(1).max(20000).optional(),
      });
      const b = Body.parse(req.body ?? {});
      const importId = (req as any).importRunId as string | undefined;

      const res = await importAhtnAliases({
        url: b.url,
        batchSize: b.batchSize,
        importId,
        makeSourceRef: (code8) => `ahtn8:${code8}`,
      });
      return reply.send(res);
    }
  );
}
