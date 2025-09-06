import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { importThMfn } from '../../../duty-rates/services/asean/th/import-mfn.js';
import { importThPreferential } from '../../../duty-rates/services/asean/th/import-preferential.js';

export default function thDutyRoutes(app: FastifyInstance) {
  // TH MFN (WITS)
  {
    const Body = z.object({
      hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
      batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
      dryRun: z.boolean().optional(),
    });

    app.post(
      '/internal/cron/import/duties/th-mfn',
      {
        preHandler: app.requireApiKey(['tasks:duties:th']),
        schema: { body: Body },
        config: { importMeta: { importSource: 'WITS', job: 'duties:th-mfn' } },
      },
      async (req, reply) => {
        const { hs6, batchSize, dryRun } = Body.parse(req.body ?? {});
        const res = await importThMfn({
          hs6List: hs6,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send(res);
      }
    );
  }

  // TH Preferential (WITS)
  {
    const Body = z.object({
      hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
      partnerGeoIds: z.array(z.string()).optional(),
      batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
      dryRun: z.boolean().optional(),
    });

    app.post(
      '/internal/cron/import/duties/th-fta',
      {
        preHandler: app.requireApiKey(['tasks:duties:th']),
        schema: { body: Body },
        config: { importMeta: { importSource: 'WITS', job: 'duties:th-fta' } },
      },
      async (req, reply) => {
        const { hs6, partnerGeoIds, batchSize, dryRun } = Body.parse(req.body ?? {});
        const res = await importThPreferential({
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
