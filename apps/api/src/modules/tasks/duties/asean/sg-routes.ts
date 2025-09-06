import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { importSgMfn } from '../../../duty-rates/services/asean/sg/import-mfn.js';
import { importSgPreferential } from '../../../duty-rates/services/asean/sg/import-preferential.js';

export default function sgDutyRoutes(app: FastifyInstance) {
  const Common = {
    preHandler: app.requireApiKey(['tasks:duties:sg']),
  };

  // MFN (mostly zero, WITS confirms)
  app.post(
    '/internal/cron/import/duties/sg-mfn',
    { ...Common, config: { importMeta: { importSource: 'WITS', job: 'duties:sg-mfn' } } },
    async (req, reply) => {
      const Body = z.object({
        hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
        batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
        dryRun: z.boolean().optional(),
      });
      const { hs6, batchSize, dryRun } = Body.parse(req.body ?? {});
      const res = await importSgMfn({
        hs6List: hs6,
        batchSize,
        dryRun,
        importId: req.importCtx?.runId,
      });
      return reply.send(res);
    }
  );

  // Preferential (FTA)
  app.post(
    '/internal/cron/import/duties/sg-fta',
    { ...Common, config: { importMeta: { importSource: 'WITS', job: 'duties:sg-fta' } } },
    async (req, reply) => {
      const Body = z.object({
        hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
        partnerGeoIds: z.array(z.string()).optional(),
        batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
        dryRun: z.boolean().optional(),
      });
      const { hs6, partnerGeoIds, batchSize, dryRun } = Body.parse(req.body ?? {});
      const res = await importSgPreferential({
        hs6List: hs6,
        partnerGeoIds,
        batchSize,
        dryRun,
        importId: req.importCtx?.runId,
      });
      return reply.send(res);
    }
  );
}
