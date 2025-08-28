import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { importUsTradeRemediesFromHTS } from '../../surcharges/services/us/import-usitc-hts.js';
import { importAllUsSurcharges } from '../../surcharges/services/us/import-all.js';

export default function surchargeUsRoutes(app: FastifyInstance) {
  // US trade remedies (Section 301/232) from HTS JSON
  {
    const Body = z.object({
      effectiveFrom: z.coerce.date().optional(),
      skipFree: z.coerce.boolean().default(false),
      batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
    });

    app.post(
      '/internal/cron/import/surcharges/us-trade-remedies',
      {
        preHandler: app.requireApiKey(['tasks:surcharges:us-trade-remedies']),
        schema: { body: Body.optional() },
        config: { importMeta: { source: 'USITC_HTS', job: 'surcharges:us-trade-remedies' } },
      },
      async (req, reply) => {
        const { effectiveFrom, skipFree, batchSize } = Body.parse(req.body ?? {});
        const importId = req.importCtx?.runId;

        const res = await importUsTradeRemediesFromHTS({
          effectiveFrom,
          skipFree,
          importId,
          batchSize: batchSize ?? 5000,
        });

        return reply.send(res);
      }
    );
  }

  // US generic surcharges bundle (MPF/HMF/etc.)
  {
    const Body = z.object({
      batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
    });

    app.post(
      '/internal/cron/import/surcharges/us-all',
      {
        preHandler: app.requireApiKey(['tasks:surcharges:us-all']),
        schema: { body: Body.optional() },
        config: { importMeta: { source: 'US', job: 'surcharges:us-all' } },
      },
      async (req, reply) => {
        const { batchSize } = Body.parse(req.body ?? {});
        const importId = req.importCtx?.runId;

        const res = await importAllUsSurcharges({
          batchSize: batchSize ?? 5000,
          importId,
        });

        return reply.send(res);
      }
    );
  }
}
