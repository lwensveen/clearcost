import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { importMyMfn } from '../../../duty-rates/services/asean/my/import-mfn.js';
import { importMyPreferential } from '../../../duty-rates/services/asean/my/import-preferential.js';

export default function myDutyRoutes(app: FastifyInstance) {
  // MY MFN (WITS)
  {
    const Body = z.object({
      hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
      batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
      dryRun: z.boolean().optional(),
    });

    app.post(
      '/internal/cron/import/duties/my-mfn',
      {
        preHandler: app.requireApiKey(['tasks:duties:my']),
        schema: { body: Body },
        config: { importMeta: { importSource: 'WITS', job: 'duties:my-mfn' } },
      },
      async (req, reply) => {
        const { hs6, batchSize, dryRun } = Body.parse(req.body ?? {});
        const res = await importMyMfn({
          hs6List: hs6,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send(res);
      }
    );
  }

  // MY Preferential (WITS)
  {
    const Body = z.object({
      hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
      partnerGeoIds: z.array(z.string()).optional(),
      batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
      dryRun: z.boolean().optional(),
    });

    app.post(
      '/internal/cron/import/duties/my-fta',
      {
        preHandler: app.requireApiKey(['tasks:duties:my']),
        schema: { body: Body },
        config: { importMeta: { importSource: 'WITS', job: 'duties:my-fta' } },
      },
      async (req, reply) => {
        const { hs6, partnerGeoIds, batchSize, dryRun } = Body.parse(req.body ?? {});
        const res = await importMyPreferential({
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
}
