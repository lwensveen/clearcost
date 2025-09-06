import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { importPhMfnExcel } from '../../../duty-rates/services/asean/ph/import-mfn-excel.js';

export default function phDutyRoutes(app: FastifyInstance) {
  const Body = z.object({
    url: z.string().min(1).optional(), // falls back to env
    sheet: z.union([z.string(), z.coerce.number()]).optional(),
    mapFreeToZero: z.boolean().optional(),
    skipSpecific: z.boolean().optional(),
    batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
    dryRun: z.boolean().optional(),
  });

  app.post(
    '/internal/cron/import/duties/ph-mfn',
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
}
