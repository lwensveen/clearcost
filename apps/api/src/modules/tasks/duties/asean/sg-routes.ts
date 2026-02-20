import { FastifyInstance } from 'fastify';
import { importSgMfn } from '../../../duty-rates/services/asean/sg/import-mfn.js';
import { importSgPreferential } from '../../../duty-rates/services/asean/sg/import-preferential.js';
import { importAseanMfnOfficialFromExcel } from '../../../duty-rates/services/asean/shared/import-mfn-official-excel.js';
import { importAseanPreferentialOfficialFromExcel } from '../../../duty-rates/services/asean/shared/import-preferential-official-excel.js';
import { resolveAseanDutySourceUrl } from '../../../duty-rates/services/asean/source-urls.js';
import {
  TasksDutyHs6BatchDryRunBodySchema,
  TasksDutyHs6BatchPartnerGeoIdsBodySchema,
  TasksDutyMyFtaOfficialExcelBodySchema,
  TasksDutyMyOfficialExcelBodySchema,
} from '@clearcost/types';

export default function sgDutyRoutes(app: FastifyInstance) {
  const Common = {
    preHandler: app.requireApiKey(['tasks:duties:sg']),
  };

  // MFN (mostly zero, WITS confirms)
  app.post(
    '/cron/import/duties/sg-mfn',
    {
      ...Common,
      config: {
        importMeta: {
          importSource: 'WITS',
          job: 'duties:sg-mfn',
          sourceKey: 'duties.wits.sdmx.base',
        },
      },
    },
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

  app.post(
    '/cron/import/duties/sg-mfn/official/excel',
    {
      ...Common,
      schema: { body: TasksDutyMyOfficialExcelBodySchema },
      config: {
        importMeta: {
          importSource: 'OFFICIAL',
          job: 'duties:sg-mfn-official',
          sourceKey: 'duties.sg.official.mfn_excel',
        },
      },
    },
    async (req, reply) => {
      const Body = TasksDutyMyOfficialExcelBodySchema;
      const { url, sheet, batchSize, dryRun } = Body.parse(req.body ?? {});
      const urlOrPath = await resolveAseanDutySourceUrl({
        sourceKey: 'duties.sg.official.mfn_excel',
        fallbackUrl: url,
      });
      const res = await importAseanMfnOfficialFromExcel({
        dest: 'SG',
        urlOrPath,
        sheet,
        batchSize,
        dryRun,
        importId: req.importCtx?.runId,
      });
      return reply.send({ importId: req.importCtx?.runId, ...res });
    }
  );

  // Preferential (FTA)
  app.post(
    '/cron/import/duties/sg-fta',
    {
      ...Common,
      config: {
        importMeta: {
          importSource: 'WITS',
          job: 'duties:sg-fta',
          sourceKey: 'duties.wits.sdmx.base',
        },
      },
    },
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

  app.post(
    '/cron/import/duties/sg-fta/official/excel',
    {
      ...Common,
      schema: { body: TasksDutyMyFtaOfficialExcelBodySchema },
      config: {
        importMeta: {
          importSource: 'OFFICIAL',
          job: 'duties:sg-fta-official',
          sourceKey: 'duties.sg.official.fta_excel',
        },
      },
    },
    async (req, reply) => {
      const Body = TasksDutyMyFtaOfficialExcelBodySchema;
      const { url, agreement, partner, sheet, batchSize, dryRun } = Body.parse(req.body ?? {});
      const urlOrPath = await resolveAseanDutySourceUrl({
        sourceKey: 'duties.sg.official.fta_excel',
        fallbackUrl: url,
      });
      const res = await importAseanPreferentialOfficialFromExcel({
        dest: 'SG',
        urlOrPath,
        agreement,
        partner,
        sheet,
        batchSize,
        dryRun,
        importId: req.importCtx?.runId,
      });
      return reply.send({ importId: req.importCtx?.runId, ...res });
    }
  );
}
