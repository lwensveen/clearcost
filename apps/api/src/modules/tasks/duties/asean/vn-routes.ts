// apps/api/src/modules/tasks/duties/vn-routes.ts
import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { importVnMfn } from '../../../duty-rates/services/asean/vn/import-mfn.js';
import { importVnPreferential } from '../../../duty-rates/services/asean/vn/import-preferential.js';

export default function vnDutyRoutes(app: FastifyInstance) {
  // MFN
  {
    const Body = z.object({
      hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
      batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
      dryRun: z.boolean().optional(),
    });

    app.post(
      '/internal/cron/import/duties/vn-mfn',
      {
        preHandler: app.requireApiKey(['tasks:duties:vn']),
        schema: { body: Body },
        config: { importMeta: { importSource: 'WITS', job: 'duties:vn-mfn' } },
      },
      async (req, reply) => {
        const { hs6, batchSize, dryRun } = Body.parse(req.body ?? {});
        const res = await importVnMfn({
          hs6List: hs6,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send({ importId: req.importCtx?.runId, ...res });
      }
    );
  }

  // Preferential (FTA)
  {
    const Body = z.object({
      hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
      partnerGeoIds: z.array(z.string()).optional(),
      batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
      dryRun: z.boolean().optional(),
    });

    app.post(
      '/internal/cron/import/duties/vn-fta',
      {
        preHandler: app.requireApiKey(['tasks:duties:vn']),
        schema: { body: Body },
        config: { importMeta: { importSource: 'WITS', job: 'duties:vn-fta' } },
      },
      async (req, reply) => {
        const { hs6, partnerGeoIds, batchSize, dryRun } = Body.parse(req.body ?? {});
        const res = await importVnPreferential({
          hs6List: hs6,
          partnerGeoIds,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send({ importId: req.importCtx?.runId, ...res });
      }
    );
  }
}
