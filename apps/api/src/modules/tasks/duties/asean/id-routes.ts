import { FastifyInstance } from 'fastify';
import { importIdMfn } from '../../../duty-rates/services/asean/id/import-mfn.js';
import { importIdPreferential } from '../../../duty-rates/services/asean/id/import-preferential.js';
import { importAseanPreferentialOfficialFromExcel } from '../../../duty-rates/services/asean/shared/import-preferential-official-excel.js';
import {
  TasksDutyIdBodySchema,
  TasksDutyIdFtaBodySchema,
  TasksDutyMyFtaOfficialExcelBodySchema,
} from '@clearcost/types';

export default function idDutyRoutes(app: FastifyInstance) {
  const Body = TasksDutyIdBodySchema;

  // MFN
  app.post(
    '/cron/import/duties/id-mfn',
    {
      preHandler: app.requireApiKey(['tasks:duties:id']),
      schema: { body: Body },
      config: {
        importMeta: {
          importSource: 'OFFICIAL',
          job: 'duties:id-mfn',
          sourceKey: 'duties.id.btki.xlsx',
        },
      },
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
      config: {
        importMeta: {
          importSource: 'WITS',
          job: 'duties:id-fta',
          sourceKey: 'duties.wits.sdmx.base',
        },
      },
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

  // Preferential (official Excel)
  app.post(
    '/cron/import/duties/id-fta/official/excel',
    {
      preHandler: app.requireApiKey(['tasks:duties:id']),
      schema: { body: TasksDutyMyFtaOfficialExcelBodySchema },
      config: {
        importMeta: {
          importSource: 'OFFICIAL',
          job: 'duties:id-fta-official',
          sourceKey: 'duties.id.official.fta_excel',
        },
      },
    },
    async (req, reply) => {
      const { url, agreement, partner, sheet, batchSize, dryRun } =
        TasksDutyMyFtaOfficialExcelBodySchema.parse(req.body ?? {});
      const res = await importAseanPreferentialOfficialFromExcel({
        dest: 'ID',
        urlOrPath: url,
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
