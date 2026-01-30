// apps/api/src/modules/tasks/duties/vn-routes.ts
import { FastifyInstance } from 'fastify';
import { importVnMfn } from '../../../duty-rates/services/asean/vn/import-mfn.js';
import { importVnPreferential } from '../../../duty-rates/services/asean/vn/import-preferential.js';
import {
  TasksDutyHs6BatchDryRunBodySchema,
  TasksDutyHs6BatchPartnerGeoIdsBodySchema,
} from '@clearcost/types';

export default function vnDutyRoutes(app: FastifyInstance) {
  // MFN
  {
    const Body = TasksDutyHs6BatchDryRunBodySchema;

    app.post(
      '/cron/import/duties/vn-mfn',
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
    const Body = TasksDutyHs6BatchPartnerGeoIdsBodySchema;

    app.post(
      '/cron/import/duties/vn-fta',
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
