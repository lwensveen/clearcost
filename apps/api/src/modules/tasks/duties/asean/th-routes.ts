import { FastifyInstance } from 'fastify';
import { importThMfn } from '../../../duty-rates/services/asean/th/import-mfn.js';
import { importThPreferential } from '../../../duty-rates/services/asean/th/import-preferential.js';
import {
  TasksDutyHs6BatchDryRunBodySchema,
  TasksDutyHs6BatchPartnerGeoIdsBodySchema,
} from '@clearcost/types';

export default function thDutyRoutes(app: FastifyInstance) {
  // TH MFN (WITS)
  {
    const Body = TasksDutyHs6BatchDryRunBodySchema;

    app.post(
      '/cron/import/duties/th-mfn',
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
    const Body = TasksDutyHs6BatchPartnerGeoIdsBodySchema;

    app.post(
      '/cron/import/duties/th-fta',
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
