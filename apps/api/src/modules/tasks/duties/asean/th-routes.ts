import { FastifyInstance } from 'fastify';
import { importThMfn } from '../../../duty-rates/services/asean/th/import-mfn.js';
import { importThPreferential } from '../../../duty-rates/services/asean/th/import-preferential.js';
import { importAseanMfnOfficialFromExcel } from '../../../duty-rates/services/asean/shared/import-mfn-official-excel.js';
import { importAseanPreferentialOfficialFromExcel } from '../../../duty-rates/services/asean/shared/import-preferential-official-excel.js';
import {
  TasksDutyHs6BatchDryRunBodySchema,
  TasksDutyHs6BatchPartnerGeoIdsBodySchema,
  TasksDutyMyFtaOfficialExcelBodySchema,
  TasksDutyMyOfficialExcelBodySchema,
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
        config: {
          importMeta: {
            importSource: 'WITS',
            job: 'duties:th-mfn',
            sourceKey: 'duties.wits.sdmx.base',
          },
        },
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

  // TH MFN (official Excel)
  {
    const Body = TasksDutyMyOfficialExcelBodySchema;

    app.post(
      '/cron/import/duties/th-mfn/official/excel',
      {
        preHandler: app.requireApiKey(['tasks:duties:th']),
        schema: { body: Body },
        config: {
          importMeta: {
            importSource: 'OFFICIAL',
            job: 'duties:th-mfn-official',
            sourceKey: 'duties.th.official.mfn_excel',
          },
        },
      },
      async (req, reply) => {
        const { url, sheet, batchSize, dryRun } = Body.parse(req.body ?? {});
        const res = await importAseanMfnOfficialFromExcel({
          dest: 'TH',
          urlOrPath: url,
          sheet,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send({ importId: req.importCtx?.runId, ...res });
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
        config: {
          importMeta: {
            importSource: 'WITS',
            job: 'duties:th-fta',
            sourceKey: 'duties.wits.sdmx.base',
          },
        },
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

  // TH Preferential (official Excel)
  {
    const Body = TasksDutyMyFtaOfficialExcelBodySchema;

    app.post(
      '/cron/import/duties/th-fta/official/excel',
      {
        preHandler: app.requireApiKey(['tasks:duties:th']),
        schema: { body: Body },
        config: {
          importMeta: {
            importSource: 'OFFICIAL',
            job: 'duties:th-fta-official',
            sourceKey: 'duties.th.official.fta_excel',
          },
        },
      },
      async (req, reply) => {
        const { url, agreement, partner, sheet, batchSize, dryRun } = Body.parse(req.body ?? {});
        const res = await importAseanPreferentialOfficialFromExcel({
          dest: 'TH',
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
}
