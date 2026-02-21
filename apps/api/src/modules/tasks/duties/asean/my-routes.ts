import { FastifyInstance } from 'fastify';
import { importMyMfnFromExcel } from '../../../duty-rates/services/asean/my/import-mfn-excel.js';
import { importMyMfn } from '../../../duty-rates/services/asean/my/import-mfn.js';
import { importMyPreferentialFromExcel } from '../../../duty-rates/services/asean/my/import-preferential-excel.js';
import { importMyPreferential } from '../../../duty-rates/services/asean/my/import-preferential.js';
import { resolveAseanDutySourceUrl } from '../../../duty-rates/services/asean/source-urls.js';
import {
  TasksDutyHs6BatchDryRunBodySchema,
  TasksDutyHs6BatchPartnerGeoIdsBodySchema,
  TasksDutyMyFtaOfficialExcelBodySchema,
  TasksDutyMyOfficialExcelBodySchema,
} from '@clearcost/types';

export default function myDutyRoutes(app: FastifyInstance) {
  // MY MFN (official Excel default)
  {
    const Body = TasksDutyMyOfficialExcelBodySchema;

    app.post(
      '/cron/import/duties/my-mfn',
      {
        preHandler: app.requireApiKey(['tasks:duties:my']),
        schema: { body: Body },
        config: {
          importMeta: {
            importSource: 'OFFICIAL',
            job: 'duties:my-mfn-excel',
            sourceKey: 'duties.my.official.mfn_excel',
          },
        },
      },
      async (req, reply) => {
        const { url, sheet, batchSize, dryRun } = Body.parse(req.body ?? {});
        const urlOrPath = await resolveAseanDutySourceUrl({
          sourceKey: 'duties.my.official.mfn_excel',
          fallbackUrl: url,
        });
        const res = await importMyMfnFromExcel({
          url: urlOrPath,
          sheet,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send(res);
      }
    );
  }

  // MY MFN (WITS fallback)
  {
    const Body = TasksDutyHs6BatchDryRunBodySchema;

    app.post(
      '/cron/import/duties/my-mfn/wits',
      {
        preHandler: app.requireApiKey(['tasks:duties:my']),
        schema: { body: Body },
        config: {
          importMeta: {
            importSource: 'WITS',
            job: 'duties:my-mfn-wits',
            sourceKey: 'duties.wits.sdmx.base',
          },
        },
      },
      async (req, reply) => {
        const { hs6, batchSize, dryRun } = Body.parse(req.body ?? {});
        const res = await importMyMfn({
          hs6List: hs6,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send(res);
      }
    );
  }

  // MY Preferential (official Excel default)
  {
    const Body = TasksDutyMyFtaOfficialExcelBodySchema;

    app.post(
      '/cron/import/duties/my-fta',
      {
        preHandler: app.requireApiKey(['tasks:duties:my']),
        schema: { body: Body },
        config: {
          importMeta: {
            importSource: 'OFFICIAL',
            job: 'duties:my-fta-excel',
            sourceKey: 'duties.my.official.fta_excel',
          },
        },
      },
      async (req, reply) => {
        const { url, agreement, partner, sheet, batchSize, dryRun } = Body.parse(req.body ?? {});
        const urlOrPath = await resolveAseanDutySourceUrl({
          sourceKey: 'duties.my.official.fta_excel',
          fallbackUrl: url,
        });
        const res = await importMyPreferentialFromExcel({
          url: urlOrPath,
          agreement,
          partner,
          sheet,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send(res);
      }
    );
  }

  // MY Preferential (WITS fallback)
  {
    const Body = TasksDutyHs6BatchPartnerGeoIdsBodySchema;

    app.post(
      '/cron/import/duties/my-fta/wits',
      {
        preHandler: app.requireApiKey(['tasks:duties:my']),
        schema: { body: Body },
        config: {
          importMeta: {
            importSource: 'WITS',
            job: 'duties:my-fta-wits',
            sourceKey: 'duties.wits.sdmx.base',
          },
        },
      },
      async (req, reply) => {
        const { hs6, partnerGeoIds, batchSize, dryRun } = Body.parse(req.body ?? {});
        const res = await importMyPreferential({
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
}
