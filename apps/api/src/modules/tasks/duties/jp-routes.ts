import { FastifyInstance } from 'fastify';
import { importJpMfn } from '../../duty-rates/services/jp/import-mfn.js';
import {
  importJpPreferential,
  importJpPreferentialFromWits,
} from '../../duty-rates/services/jp/import-preferential.js';
import {
  TasksDutyHs6BatchDryRunBodySchema,
  TasksDutyHs6BatchPartnerGeoIdsBodySchema,
} from '@clearcost/types';

export default function jpDutyRoutes(app: FastifyInstance) {
  // JP MFN
  {
    const Body = TasksDutyHs6BatchDryRunBodySchema;

    app.post(
      '/cron/import/duties/jp-mfn',
      {
        preHandler: app.requireApiKey(['tasks:duties:jp']),
        schema: { body: Body },
        config: {
          importMeta: {
            importSource: 'JP_CUSTOMS',
            job: 'duties:jp-mfn',
            sourceKey: 'duties.jp.customs.tariff_index',
          },
        },
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

  // JP Preferential (strict official default; WITS fallback for uncovered partners)
  {
    const Body = TasksDutyHs6BatchPartnerGeoIdsBodySchema;

    app.post(
      '/cron/import/duties/jp-fta',
      {
        preHandler: app.requireApiKey(['tasks:duties:jp']),
        schema: { body: Body },
        config: {
          importMeta: {
            importSource: 'JP_CUSTOMS',
            job: 'duties:jp-fta-official',
            sourceKey: 'duties.jp.customs.tariff_index',
          },
        },
      },
      async (req, reply) => {
        const { hs6, partnerGeoIds, batchSize, dryRun } = Body.parse(req.body ?? {});
        const res = await importJpPreferential({
          hs6List: hs6,
          partnerGeoIds,
          batchSize,
          dryRun,
          strictOfficial: true,
          useWitsFallback: true,
          importId: req.importCtx?.runId,
        });
        return reply.send({ importId: req.importCtx?.runId, ...res });
      }
    );
  }

  // JP Preferential (WITS explicit)
  {
    const Body = TasksDutyHs6BatchPartnerGeoIdsBodySchema;

    app.post(
      '/cron/import/duties/jp-fta/wits',
      {
        preHandler: app.requireApiKey(['tasks:duties:jp']),
        schema: { body: Body },
        config: {
          importMeta: {
            importSource: 'WITS',
            job: 'duties:jp-fta-wits',
            sourceKey: 'duties.wits.sdmx.base',
          },
        },
      },
      async (req, reply) => {
        const { hs6, partnerGeoIds, batchSize, dryRun } = Body.parse(req.body ?? {});
        const res = await importJpPreferentialFromWits({
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
