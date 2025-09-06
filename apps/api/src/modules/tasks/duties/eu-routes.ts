import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { importEuMfn } from '../../duty-rates/services/eu/import-mfn.js';
import { importEuPreferential } from '../../duty-rates/services/eu/import-preferential.js';
import { importEuFromDaily } from '../../duty-rates/services/eu/import-daily.js';

export default function euDutyRoutes(app: FastifyInstance) {
  // EU MFN (TARIC)
  {
    const Body = z.object({
      hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
      batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
      dryRun: z.boolean().optional(),
    });

    app.post(
      '/internal/cron/import/duties/eu-mfn',
      {
        preHandler: app.requireApiKey(['tasks:duties:eu']),
        schema: { body: Body },
        config: { importMeta: { importSource: 'TARIC', job: 'duties:eu-mfn' } },
      },
      async (req, reply) => {
        const { hs6, batchSize, dryRun } = Body.parse(req.body ?? {});
        const res = await importEuMfn({
          hs6List: hs6,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send(res);
      }
    );
  }

  // EU Preferential (TARIC)
  {
    const Body = z.object({
      hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
      partnerGeoIds: z.array(z.string()).optional(),
      batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
      dryRun: z.boolean().optional(),
    });

    app.post(
      '/internal/cron/import/duties/eu-fta',
      {
        preHandler: app.requireApiKey(['tasks:duties:eu']),
        schema: { body: Body },
        config: { importMeta: { importSource: 'TARIC', job: 'duties:eu-fta' } },
      },
      async (req, reply) => {
        const { hs6, partnerGeoIds, batchSize, dryRun } = Body.parse(req.body ?? {});
        const res = await importEuPreferential({
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

  // EU Daily (TARIC) — downloads latest (or specific date) and runs the XML importer
  {
    const Body = z.object({
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(), // backfill support
      include: z.enum(['mfn', 'fta', 'both']).optional().default('both'),
      partnerGeoIds: z.array(z.string()).optional(),
      batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
      dryRun: z.boolean().optional(),
    });

    app.post(
      '/internal/cron/import/duties/eu/daily',
      {
        preHandler: app.requireApiKey(['tasks:duties:eu']),
        schema: { body: Body },
        config: { importMeta: { importSource: 'TARIC', job: 'duties:eu-daily' } },
      },
      async (req, reply) => {
        const { date, include, partnerGeoIds, batchSize, dryRun } = Body.parse(req.body ?? {});
        const result = await importEuFromDaily({
          date,
          include,
          partnerGeoIds,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });

        return reply.send({
          importId: req.importCtx?.runId,
          ...result,
        });
      }
    );
  }
}
