import { FastifyInstance } from 'fastify';
import { importMyMfnFromExcel } from '../../../duty-rates/services/asean/my/import-mfn-excel.js';
import { importMyMfnFromGazettePdf } from '../../../duty-rates/services/asean/my/import-mfn-gazette-pdf.js';
import { importMyPreferentialFromExcel } from '../../../duty-rates/services/asean/my/import-preferential-excel.js';
import {
  TasksDutyMyFtaOfficialExcelBodySchema,
  TasksDutyMyOfficialExcelBodySchema,
  TasksDutyMyOfficialPdfBodySchema,
} from '@clearcost/types';

export default function myDutyRoutesOfficial(app: FastifyInstance) {
  // MFN — Excel/CSV
  {
    const Body = TasksDutyMyOfficialExcelBodySchema;

    app.post(
      '/cron/import/duties/my-mfn/official/excel',
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
        const result = await importMyMfnFromExcel({
          url,
          sheet,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send(result);
      }
    );
  }

  // MFN — Gazette PDF
  {
    const Body = TasksDutyMyOfficialPdfBodySchema;

    app.post(
      '/cron/import/duties/my-mfn/official/pdf',
      {
        preHandler: app.requireApiKey(['tasks:duties:my']),
        schema: { body: Body },
        config: {
          importMeta: {
            importSource: 'MY_GAZETTE',
            job: 'duties:my-mfn-pdf',
            sourceKey: 'duties.my.gazette.mfn_pdf',
          },
        },
      },
      async (req, reply) => {
        const { url, batchSize, dryRun } = Body.parse(req.body ?? {});
        const result = await importMyMfnFromGazettePdf({
          url,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send(result);
      }
    );
  }

  // Preferential — Excel (ASEAN/RCEP/bilateral schedules)
  {
    const Body = TasksDutyMyFtaOfficialExcelBodySchema;

    app.post(
      '/cron/import/duties/my-fta/official/excel',
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
        const result = await importMyPreferentialFromExcel({
          url,
          agreement,
          partner,
          sheet,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send(result);
      }
    );
  }
}
