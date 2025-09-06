import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { importCnMfn } from '../../duty-rates/services/cn/import-mfn.js';
import { importCnPreferential } from '../../duty-rates/services/cn/import-preferential.js';

export default function cnDutyRoutes(app: FastifyInstance) {
  // CN MFN (WITS)
  {
    const Body = z.object({
      hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
      batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
      dryRun: z.boolean().optional(),
    });

    app.post(
      '/internal/cron/import/duties/cn-mfn',
      {
        preHandler: app.requireApiKey(['tasks:duties:cn']),
        schema: { body: Body },
        config: { importMeta: { importSource: 'WITS', job: 'duties:cn-mfn' } },
      },
      async (req, reply) => {
        const { hs6, batchSize, dryRun } = Body.parse(req.body ?? {});
        const res = await importCnMfn({
          hs6List: hs6,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send(res);
      }
    );
  }

  // CN Preferential (WITS)
  {
    const Body = z.object({
      hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
      partnerGeoIds: z.array(z.string()).optional(),
      batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
      dryRun: z.boolean().optional(),
    });

    app.post(
      '/internal/cron/import/duties/cn-fta',
      {
        preHandler: app.requireApiKey(['tasks:duties:cn']),
        schema: { body: Body },
        config: { importMeta: { importSource: 'WITS', job: 'duties:cn-fta' } },
      },
      async (req, reply) => {
        const { hs6, partnerGeoIds, batchSize, dryRun } = Body.parse(req.body ?? {});
        const res = await importCnPreferential({
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
