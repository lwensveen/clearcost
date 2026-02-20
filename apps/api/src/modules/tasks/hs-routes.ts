import { FastifyInstance } from 'fastify';
import { importEuHs6FromTaric } from '../hs-codes/services/aliases/eu/import-cn6-from-taric.js';
import { importAhtnAliases } from '../hs-codes/services/aliases/asean/import-ahtn.js';
import { TasksHsAhtnBodySchema } from '@clearcost/types';

export default function hsRoutes(app: FastifyInstance) {
  // EU HS6 from TARIC
  app.post(
    '/cron/import/hs/eu-hs6',
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
    '/cron/import/hs/ahtn',
    {
      preHandler: app.requireApiKey(['tasks:hs:ahtn']),
      config: {
        importMeta: { importSource: 'AHTN', job: 'hs:ahtn', sourceKey: 'hs.asean.ahtn.csv' },
      },
      schema: { body: TasksHsAhtnBodySchema },
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
