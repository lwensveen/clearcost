import { FastifyInstance } from 'fastify';
import { importPhMfn } from '../../../duty-rates/services/asean/ph/import-mfn.js';
import { importPhMfnExcel } from '../../../duty-rates/services/asean/ph/import-mfn-excel.js';
import { importPhPreferential } from '../../../duty-rates/services/asean/ph/import-preferential.js';
import { importAseanPreferentialOfficialFromExcel } from '../../../duty-rates/services/asean/shared/import-preferential-official-excel.js';
import { resolveAseanDutySourceUrl } from '../../../duty-rates/services/asean/source-urls.js';
import {
  TasksDutyHs6BatchDryRunBodySchema,
  TasksDutyHs6BatchPartnerGeoIdsBodySchema,
  TasksDutyMyFtaOfficialExcelBodySchema,
  TasksDutyPhBodySchema,
} from '@clearcost/types';

export default function phDutyRoutes(app: FastifyInstance) {
  const Body = TasksDutyPhBodySchema;

  app.post(
    '/cron/import/duties/ph-mfn',
    {
      preHandler: app.requireApiKey(['tasks:duties:ph']),
      schema: { body: Body },
      config: {
        importMeta: {
          importSource: 'PH_TARIFF_COMMISSION',
          job: 'duties:ph-mfn-official',
          sourceKey: 'duties.ph.tariff_commission.xlsx',
        },
      },
    },
    async (req, reply) => {
      const body = Body.parse(req.body ?? {});
      const urlOrPath = await resolveAseanDutySourceUrl({
        sourceKey: 'duties.ph.tariff_commission.xlsx',
        fallbackUrl: body.url ?? process.env.PH_TARIFF_EXCEL_URL,
      });

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
    '/cron/import/duties/ph-mfn/wits',
    {
      preHandler: app.requireApiKey(['tasks:duties:ph']),
      schema: { body: TasksDutyHs6BatchDryRunBodySchema },
      config: {
        importMeta: {
          importSource: 'WITS',
          job: 'duties:ph-mfn-wits',
          sourceKey: 'duties.wits.sdmx.base',
        },
      },
    },
    async (req, reply) => {
      const { hs6, batchSize, dryRun } = TasksDutyHs6BatchDryRunBodySchema.parse(req.body ?? {});
      const result = await importPhMfn({
        hs6List: hs6,
        batchSize,
        dryRun,
        importId: req.importCtx?.runId,
      });

      return reply.send({ importId: req.importCtx?.runId, ...result });
    }
  );

  // Preferential (official Excel default)
  app.post(
    '/cron/import/duties/ph-fta',
    {
      preHandler: app.requireApiKey(['tasks:duties:ph']),
      schema: { body: TasksDutyMyFtaOfficialExcelBodySchema },
      config: {
        importMeta: {
          importSource: 'OFFICIAL',
          job: 'duties:ph-fta-official',
          sourceKey: 'duties.ph.official.fta_excel',
        },
      },
    },
    async (req, reply) => {
      const { url, agreement, partner, sheet, batchSize, dryRun } =
        TasksDutyMyFtaOfficialExcelBodySchema.parse(req.body ?? {});
      const urlOrPath = await resolveAseanDutySourceUrl({
        sourceKey: 'duties.ph.official.fta_excel',
        fallbackUrl: url,
      });
      const result = await importAseanPreferentialOfficialFromExcel({
        dest: 'PH',
        urlOrPath,
        agreement,
        partner,
        sheet,
        batchSize,
        dryRun,
        importId: req.importCtx?.runId,
      });
      return reply.send({ importId: req.importCtx?.runId, ...result });
    }
  );

  // Preferential (WITS fallback)
  app.post(
    '/cron/import/duties/ph-fta/wits',
    {
      preHandler: app.requireApiKey(['tasks:duties:ph']),
      schema: { body: TasksDutyHs6BatchPartnerGeoIdsBodySchema },
      config: {
        importMeta: {
          importSource: 'WITS',
          job: 'duties:ph-fta-wits',
          sourceKey: 'duties.wits.sdmx.base',
        },
      },
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

  app.post(
    '/cron/import/duties/ph-fta/official/excel',
    {
      preHandler: app.requireApiKey(['tasks:duties:ph']),
      schema: { body: TasksDutyMyFtaOfficialExcelBodySchema },
      config: {
        importMeta: {
          importSource: 'OFFICIAL',
          job: 'duties:ph-fta-official',
          sourceKey: 'duties.ph.official.fta_excel',
        },
      },
    },
    async (req, reply) => {
      const { url, agreement, partner, sheet, batchSize, dryRun } =
        TasksDutyMyFtaOfficialExcelBodySchema.parse(req.body ?? {});
      const urlOrPath = await resolveAseanDutySourceUrl({
        sourceKey: 'duties.ph.official.fta_excel',
        fallbackUrl: url,
      });
      const result = await importAseanPreferentialOfficialFromExcel({
        dest: 'PH',
        urlOrPath,
        agreement,
        partner,
        sheet,
        batchSize,
        dryRun,
        importId: req.importCtx?.runId,
      });
      return reply.send({ importId: req.importCtx?.runId, ...result });
    }
  );
}
