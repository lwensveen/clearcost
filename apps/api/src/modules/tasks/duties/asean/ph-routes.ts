import { FastifyInstance } from 'fastify';
import { importPhMfnExcel } from '../../../duty-rates/services/asean/ph/import-mfn-excel.js';
import { importPhPreferential } from '../../../duty-rates/services/asean/ph/import-preferential.js';
import { TasksDutyHs6BatchPartnerGeoIdsBodySchema, TasksDutyPhBodySchema } from '@clearcost/types';

export default function phDutyRoutes(app: FastifyInstance) {
  const Body = TasksDutyPhBodySchema;

  app.post(
    '/cron/import/duties/ph-mfn',
    {
      preHandler: app.requireApiKey(['tasks:duties:ph']),
      schema: { body: Body },
      config: { importMeta: { importSource: 'PH_TARIFF_COMMISSION', job: 'duties:ph-mfn' } },
    },
    async (req, reply) => {
      const body = Body.parse(req.body ?? {});
      const urlOrPath =
        body.url ??
        process.env.PH_TARIFF_EXCEL_URL ??
        // keep explicit error over guessing URLs
        (() => {
          throw new Error('Provide "url" in body or set PH_TARIFF_EXCEL_URL');
        })();

      const result = await importPhMfnExcel({
        urlOrPath,
        sheet: body.sheet,
        mapFreeToZero: body.mapFreeToZero ?? true,
        skipSpecific: body.skipSpecific ?? true,
        batchSize: body.batchSize ?? 5_000,
        dryRun: body.dryRun,
        importId: req.importCtx?.runId,
      });

      return reply.send({ importId: req.importCtx?.runId, ...result });
    }
  );

  app.post(
    '/cron/import/duties/ph-fta',
    {
      preHandler: app.requireApiKey(['tasks:duties:ph']),
      schema: { body: TasksDutyHs6BatchPartnerGeoIdsBodySchema },
      config: { importMeta: { importSource: 'WITS', job: 'duties:ph-fta' } },
    },
    async (req, reply) => {
      const { hs6, partnerGeoIds, batchSize, dryRun } =
        TasksDutyHs6BatchPartnerGeoIdsBodySchema.parse(req.body ?? {});
      const result = await importPhPreferential({
        hs6List: hs6,
        partnerGeoIds,
        batchSize,
        dryRun,
        importId: req.importCtx?.runId,
      });

      return reply.send({ importId: req.importCtx?.runId, ...result });
    }
  );
}
