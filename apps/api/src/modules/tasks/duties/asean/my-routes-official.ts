import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { importMyMfnFromExcel } from '../../../duty-rates/services/asean/my/import-mfn-excel.js';
import { importMyMfnFromGazettePdf } from '../../../duty-rates/services/asean/my/import-mfn-gazette-pdf.js';
import { importMyPreferentialFromExcel } from '../../../duty-rates/services/asean/my/import-preferential-excel.js';

export default function myDutyRoutesOfficial(app: FastifyInstance) {
  // MFN — Excel/CSV
  {
    const Body = z.object({
      url: z.string().url(),
      sheet: z.union([z.string(), z.coerce.number()]).optional(),
      batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
      dryRun: z.boolean().optional(),
    });

    app.post(
      '/internal/cron/import/duties/my-mfn/official/excel',
      {
        preHandler: app.requireApiKey(['tasks:duties:my']),
        schema: { body: Body },
        config: { importMeta: { importSource: 'OFFICIAL', job: 'duties:my-mfn-excel' } },
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
    const Body = z.object({
      url: z.string().url(),
      batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
      dryRun: z.boolean().optional(),
    });

    app.post(
      '/internal/cron/import/duties/my-mfn/official/pdf',
      {
        preHandler: app.requireApiKey(['tasks:duties:my']),
        schema: { body: Body },
        config: { importMeta: { importSource: 'MY_GAZETTE', job: 'duties:my-mfn-pdf' } },
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
    const Body = z.object({
      url: z.string().url(),
      agreement: z.string().optional(), // 'ATIGA' | 'RCEP' | 'AJCEP'...
      partner: z.string().optional(), // override inferred partner code
      sheet: z.union([z.string(), z.coerce.number()]).optional(),
      batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
      dryRun: z.boolean().optional(),
    });

    app.post(
      '/internal/cron/import/duties/my-fta/official/excel',
      {
        preHandler: app.requireApiKey(['tasks:duties:my']),
        schema: { body: Body },
        config: { importMeta: { importSource: 'OFFICIAL', job: 'duties:my-fta-excel' } },
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
