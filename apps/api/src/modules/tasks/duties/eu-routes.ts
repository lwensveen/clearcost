import { FastifyInstance } from 'fastify';
import { importEuMfn } from '../../duty-rates/services/eu/import-mfn.js';
import { importEuPreferential } from '../../duty-rates/services/eu/import-preferential.js';
import { importEuFromDaily } from '../../duty-rates/services/eu/import-daily.js';
import {
  TasksDutyEuDailyBodySchema,
  TasksDutyEuFtaBodySchema,
  TasksDutyEuMfnBodySchema,
} from '@clearcost/types';

export default function euDutyRoutes(app: FastifyInstance) {
  // EU MFN (TARIC)
  {
    const Body = TasksDutyEuMfnBodySchema;

    app.post(
      '/cron/import/duties/eu-mfn',
      {
        preHandler: app.requireApiKey(['tasks:duties:eu']),
        schema: { body: Body },
        config: {
          importMeta: {
            importSource: 'TARIC',
            job: 'duties:eu-mfn-official',
            sourceKey: 'duties.eu.taric.mfn',
          },
        },
      },
      async (req, reply) => {
        const { hs6, xmlMeasureUrl, xmlComponentUrl, xmlDutyExprUrl, language, batchSize, dryRun } =
          Body.parse(req.body ?? {});
        const res = await importEuMfn({
          hs6List: hs6,
          batchSize,
          dryRun,
          xml: {
            measureUrl: xmlMeasureUrl,
            componentUrl: xmlComponentUrl,
            dutyExprUrl: xmlDutyExprUrl,
            language,
          },
          importId: req.importCtx?.runId,
        });
        return reply.send(res);
      }
    );
  }

  // EU Preferential (TARIC)
  {
    const Body = TasksDutyEuFtaBodySchema;

    app.post(
      '/cron/import/duties/eu-fta',
      {
        preHandler: app.requireApiKey(['tasks:duties:eu']),
        schema: { body: Body },
        config: {
          importMeta: {
            importSource: 'TARIC',
            job: 'duties:eu-fta-official',
            sourceKey: 'duties.eu.taric.preferential',
          },
        },
      },
      async (req, reply) => {
        const {
          hs6,
          partnerGeoIds,
          xmlMeasureUrl,
          xmlComponentUrl,
          xmlGeoDescUrl,
          xmlDutyExprUrl,
          language,
          batchSize,
          dryRun,
        } = Body.parse(req.body ?? {});
        const res = await importEuPreferential({
          hs6List: hs6,
          partnerGeoIds,
          batchSize,
          dryRun,
          xml: {
            measureUrl: xmlMeasureUrl,
            componentUrl: xmlComponentUrl,
            geoDescUrl: xmlGeoDescUrl,
            dutyExprUrl: xmlDutyExprUrl,
            language,
          },
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
        config: {
          importMeta: {
            importSource: 'TARIC',
            job: 'duties:eu-daily-official',
            sourceKey: 'duties.eu.taric.daily',
          },
        },
      },
      async (req, reply) => {
        const { date, include, partnerGeoIds, dailyListUrl, language, batchSize, dryRun } =
          Body.parse(req.body ?? {});
        const result = await importEuFromDaily({
          date,
          include,
          partnerGeoIds,
          dailyListUrl,
          language,
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
