import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { importEuHs6FromTaric } from '../hs-codes/services/aliases/eu/import-cn6-from-taric.js';
import { importAhtnAliases } from '../hs-codes/services/aliases/asean/import-ahtn.js';

export default function hsRoutes(app: FastifyInstance) {
  // EU HS6 from TARIC
  app.post(
    '/internal/cron/import/hs/eu-hs6',
    {
      preHandler: app.requireApiKey(['tasks:hs:eu-hs6']),
      config: { importMeta: { importSource: 'TARIC', job: 'hs:eu-hs6' } },
    },
    async (req, reply) => {
      const importId = req.importCtx?.runId;
      const res = await importEuHs6FromTaric({ importId });
      return reply.send(res);
    }
  );

  // ASEAN AHTN aliases
  app.post(
    '/internal/cron/import/hs/ahtn',
    {
      preHandler: app.requireApiKey(['tasks:hs:ahtn']),
      config: { importMeta: { importSource: 'AHTN', job: 'hs:ahtn' } },
      schema: {
        body: z.object({
          url: z.string().url().optional(),
          batchSize: z.coerce.number().int().min(1).max(20000).optional(),
        }),
      },
    },
    async (req, reply) => {
      const { url, batchSize } = (req.body ?? {}) as {
        url?: string;
        batchSize?: number;
      };
      const importId = req.importCtx?.runId;

      const res = await importAhtnAliases({
        url,
        batchSize,
        importId,
        makeSourceRef: (code8) => `ahtn8:${code8}`,
      });

      return reply.send(res);
    }
  );
}
