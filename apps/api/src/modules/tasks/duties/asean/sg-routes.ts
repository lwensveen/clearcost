import { FastifyInstance } from 'fastify';
import { importSgMfn } from '../../../duty-rates/services/asean/sg/import-mfn.js';
import { importSgPreferential } from '../../../duty-rates/services/asean/sg/import-preferential.js';
import {
  TasksDutyHs6BatchDryRunBodySchema,
  TasksDutyHs6BatchPartnerGeoIdsBodySchema,
} from '@clearcost/types';

export default function sgDutyRoutes(app: FastifyInstance) {
  const Common = {
    preHandler: app.requireApiKey(['tasks:duties:sg']),
  };

  // MFN (mostly zero, WITS confirms)
  app.post(
    '/cron/import/duties/sg-mfn',
    { ...Common, config: { importMeta: { importSource: 'WITS', job: 'duties:sg-mfn' } } },
    async (req, reply) => {
      const Body = TasksDutyHs6BatchDryRunBodySchema;
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
    '/cron/import/duties/sg-fta',
    { ...Common, config: { importMeta: { importSource: 'WITS', job: 'duties:sg-fta' } } },
    async (req, reply) => {
      const Body = TasksDutyHs6BatchPartnerGeoIdsBodySchema;
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
