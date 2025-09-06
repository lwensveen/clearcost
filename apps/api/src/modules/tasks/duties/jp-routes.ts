import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { importJpMfn } from '../../duty-rates/services/jp/import-mfn.js';
import { importJpPreferential } from '../../duty-rates/services/jp/import-preferential.js';

export default function jpDutyRoutes(app: FastifyInstance) {
  // JP MFN
  {
    const Body = z.object({
      hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
      batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
      dryRun: z.boolean().optional(),
    });

    app.post(
      '/internal/cron/import/duties/jp-mfn',
      {
        preHandler: app.requireApiKey(['tasks:duties:jp']),
        schema: { body: Body },
        config: { importMeta: { importSource: 'JP_CUSTOMS', job: 'duties:jp-mfn' } },
      },
      async (req, reply) => {
        const { hs6, batchSize, dryRun } = Body.parse(req.body ?? {});
        const res = await importJpMfn({
          hs6List: hs6,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send({ importId: req.importCtx?.runId, ...res });
      }
    );
  }

  // JP Preferential (WITS)
  {
    const Body = z.object({
      hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
      partnerGeoIds: z.array(z.string()).optional(),
      batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
      dryRun: z.boolean().optional(),
    });

    app.post(
      '/internal/cron/import/duties/jp-fta',
      {
        preHandler: app.requireApiKey(['tasks:duties:jp']),
        schema: { body: Body },
        config: { importMeta: { importSource: 'WITS', job: 'duties:jp-fta' } },
      },
      async (req, reply) => {
        const { hs6, partnerGeoIds, batchSize, dryRun } = Body.parse(req.body ?? {});
        const res = await importJpPreferential({
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
