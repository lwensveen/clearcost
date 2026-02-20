// apps/api/src/modules/tasks/duties/vn-routes.ts
import { FastifyInstance } from 'fastify';
import { importVnMfn } from '../../../duty-rates/services/asean/vn/import-mfn.js';
import { importVnPreferential } from '../../../duty-rates/services/asean/vn/import-preferential.js';
import { importAseanMfnOfficialFromExcel } from '../../../duty-rates/services/asean/shared/import-mfn-official-excel.js';
import { importAseanPreferentialOfficialFromExcel } from '../../../duty-rates/services/asean/shared/import-preferential-official-excel.js';
import { resolveAseanDutySourceUrl } from '../../../duty-rates/services/asean/source-urls.js';
import {
  TasksDutyHs6BatchDryRunBodySchema,
  TasksDutyHs6BatchPartnerGeoIdsBodySchema,
  TasksDutyMyFtaOfficialExcelBodySchema,
  TasksDutyMyOfficialExcelBodySchema,
} from '@clearcost/types';

export default function vnDutyRoutes(app: FastifyInstance) {
  // MFN
  {
    const Body = TasksDutyHs6BatchDryRunBodySchema;

    app.post(
      '/cron/import/duties/vn-mfn',
      {
        preHandler: app.requireApiKey(['tasks:duties:vn']),
        schema: { body: Body },
        config: {
          importMeta: {
            importSource: 'WITS',
            job: 'duties:vn-mfn',
            sourceKey: 'duties.wits.sdmx.base',
          },
        },
      },
      async (req, reply) => {
        const { hs6, batchSize, dryRun } = Body.parse(req.body ?? {});
        const res = await importVnMfn({
          hs6List: hs6,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send({ importId: req.importCtx?.runId, ...res });
      }
    );
  }

  // MFN (official Excel)
  {
    const Body = TasksDutyMyOfficialExcelBodySchema;

    app.post(
      '/cron/import/duties/vn-mfn/official/excel',
      {
        preHandler: app.requireApiKey(['tasks:duties:vn']),
        schema: { body: Body },
        config: {
          importMeta: {
            importSource: 'OFFICIAL',
            job: 'duties:vn-mfn-official',
            sourceKey: 'duties.vn.official.mfn_excel',
          },
        },
      },
      async (req, reply) => {
        const { url, sheet, batchSize, dryRun } = Body.parse(req.body ?? {});
        const urlOrPath = await resolveAseanDutySourceUrl({
          sourceKey: 'duties.vn.official.mfn_excel',
          fallbackUrl: url,
        });
        const res = await importAseanMfnOfficialFromExcel({
          dest: 'VN',
          urlOrPath,
          sheet,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send({ importId: req.importCtx?.runId, ...res });
      }
    );
  }

  // Preferential (FTA)
  {
    const Body = TasksDutyHs6BatchPartnerGeoIdsBodySchema;

    app.post(
      '/cron/import/duties/vn-fta',
      {
        preHandler: app.requireApiKey(['tasks:duties:vn']),
        schema: { body: Body },
        config: {
          importMeta: {
            importSource: 'WITS',
            job: 'duties:vn-fta',
            sourceKey: 'duties.wits.sdmx.base',
          },
        },
      },
      async (req, reply) => {
        const { hs6, partnerGeoIds, batchSize, dryRun } = Body.parse(req.body ?? {});
        const res = await importVnPreferential({
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

  // Preferential (FTA, official Excel)
  {
    const Body = TasksDutyMyFtaOfficialExcelBodySchema;

    app.post(
      '/cron/import/duties/vn-fta/official/excel',
      {
        preHandler: app.requireApiKey(['tasks:duties:vn']),
        schema: { body: Body },
        config: {
          importMeta: {
            importSource: 'OFFICIAL',
            job: 'duties:vn-fta-official',
            sourceKey: 'duties.vn.official.fta_excel',
          },
        },
      },
      async (req, reply) => {
        const { url, agreement, partner, sheet, batchSize, dryRun } = Body.parse(req.body ?? {});
        const urlOrPath = await resolveAseanDutySourceUrl({
          sourceKey: 'duties.vn.official.fta_excel',
          fallbackUrl: url,
        });
        const res = await importAseanPreferentialOfficialFromExcel({
          dest: 'VN',
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
}
