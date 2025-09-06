import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { importIdMfn } from '../../../duty-rates/services/asean/id/import-mfn.js';
import { importIdPreferential } from '../../../duty-rates/services/asean/id/import-preferential.js';

export default function idDutyRoutes(app: FastifyInstance) {
  const Body = z.object({
    batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
    dryRun: z.boolean().optional(),
  });

  // MFN
  app.post(
    '/internal/cron/import/duties/id-mfn',
    {
      preHandler: app.requireApiKey(['tasks:duties:id']),
      schema: { body: Body },
      config: { importMeta: { importSource: 'OFFICIAL', job: 'duties:id-mfn' } },
    },
    async (req, reply) => {
      const { batchSize, dryRun } = Body.parse(req.body ?? {});
      const res = await importIdMfn({ batchSize, dryRun, importId: req.importCtx?.runId });
      return reply.send(res);
    }
  );

  // Preferential (WITS fallback)
  app.post(
    '/internal/cron/import/duties/id-fta',
    {
      preHandler: app.requireApiKey(['tasks:duties:id']),
      schema: { body: Body.extend({ partnerGeoIds: z.array(z.string()).optional() }) },
      config: { importMeta: { importSource: 'WITS', job: 'duties:id-fta' } },
    },
    async (req, reply) => {
      const { batchSize, dryRun, partnerGeoIds } = Body.extend({
        partnerGeoIds: z.array(z.string()).optional(),
      }).parse(req.body ?? {});
      const res = await importIdPreferential({
        batchSize,
        dryRun,
        importId: req.importCtx?.runId,
        partnerGeoIds,
      });
      return reply.send(res);
    }
  );
}
