import { FastifyInstance } from 'fastify';
import { importEuMfn } from '../../duty-rates/services/eu/import-mfn.js';
import { importEuPreferential } from '../../duty-rates/services/eu/import-preferential.js';
import { importEuFromDaily } from '../../duty-rates/services/eu/import-daily.js';
import {
  TasksDutyEuDailyBodySchema,
  TasksDutyHs6BatchDryRunBodySchema,
  TasksDutyHs6BatchPartnerGeoIdsBodySchema,
} from '@clearcost/types';

export default function euDutyRoutes(app: FastifyInstance) {
  // EU MFN (TARIC)
  {
    const Body = TasksDutyHs6BatchDryRunBodySchema;

    app.post(
      '/cron/import/duties/eu-mfn',
      {
        preHandler: app.requireApiKey(['tasks:duties:eu']),
        schema: { body: Body },
        config: { importMeta: { importSource: 'TARIC', job: 'duties:eu-mfn' } },
      },
      async (req, reply) => {
        const { hs6, batchSize, dryRun } = Body.parse(req.body ?? {});
        const res = await importEuMfn({
          hs6List: hs6,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send(res);
      }
    );
  }

  // EU Preferential (TARIC)
  {
    const Body = TasksDutyHs6BatchPartnerGeoIdsBodySchema;

    app.post(
      '/cron/import/duties/eu-fta',
      {
        preHandler: app.requireApiKey(['tasks:duties:eu']),
        schema: { body: Body },
        config: { importMeta: { importSource: 'TARIC', job: 'duties:eu-fta' } },
      },
      async (req, reply) => {
        const { hs6, partnerGeoIds, batchSize, dryRun } = Body.parse(req.body ?? {});
        const res = await importEuPreferential({
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

  // EU Daily (TARIC) — downloads latest (or specific date) and runs the XML importer
  {
    const Body = TasksDutyEuDailyBodySchema;

    app.post(
      '/cron/import/duties/eu/daily',
      {
        preHandler: app.requireApiKey(['tasks:duties:eu']),
        schema: { body: Body },
        config: { importMeta: { importSource: 'TARIC', job: 'duties:eu-daily' } },
      },
      async (req, reply) => {
        const { date, include, partnerGeoIds, batchSize, dryRun } = Body.parse(req.body ?? {});
        const result = await importEuFromDaily({
          date,
          include,
          partnerGeoIds,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });

        return reply.send({
          importId: req.importCtx?.runId,
          ...result,
        });
      }
    );
  }
}
