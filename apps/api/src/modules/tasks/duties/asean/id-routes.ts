import { FastifyInstance } from 'fastify';
import { importIdMfn } from '../../../duty-rates/services/asean/id/import-mfn.js';
import { importIdPreferential } from '../../../duty-rates/services/asean/id/import-preferential.js';
import { TasksDutyIdBodySchema, TasksDutyIdFtaBodySchema } from '@clearcost/types';

export default function idDutyRoutes(app: FastifyInstance) {
  const Body = TasksDutyIdBodySchema;

  // MFN
  app.post(
    '/cron/import/duties/id-mfn',
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
    '/cron/import/duties/id-fta',
    {
      preHandler: app.requireApiKey(['tasks:duties:id']),
      schema: { body: TasksDutyIdFtaBodySchema },
      config: { importMeta: { importSource: 'WITS', job: 'duties:id-fta' } },
    },
    async (req, reply) => {
      const { batchSize, dryRun, partnerGeoIds } = TasksDutyIdFtaBodySchema.parse(req.body ?? {});
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
