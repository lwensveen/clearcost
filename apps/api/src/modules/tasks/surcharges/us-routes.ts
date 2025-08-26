import { FastifyInstance } from 'fastify';
import { adminGuard } from '../common.js';
import { z } from 'zod/v4';
import { importUsTradeRemediesFromHTS } from '../../surcharges/services/us/import-usitc-hts.js';
import { importAllUsSurcharges } from '../../surcharges/services/us/import-all.js';

export default function surchargeUsRoutes(app: FastifyInstance) {
  // US trade remedies (Section 301/232) from HTS JSON
  app.post(
    '/internal/cron/import/surcharges/us-trade-remedies',
    {
      preHandler: adminGuard,

      schema: {
        body: z.object({
          effectiveFrom: z.coerce.date().optional(),
          skipFree: z.coerce.boolean().optional(),
        }),
      },
      config: { importMeta: { source: 'USITC_HTS', job: 'surcharges:us-trade-remedies' } },
    },
    async (req, reply) => {
      const { effectiveFrom, skipFree } = (req.body ?? {}) as {
        effectiveFrom?: Date;
        skipFree?: boolean;
      };

      const importId = (req as any).importRunId as string | undefined;

      const res = await importUsTradeRemediesFromHTS({
        effectiveFrom,
        skipFree,
        importId,
        batchSize: 5000,
      });

      return reply.send(res);
    }
  );

  // US generic surcharges bundle (MPF/HMF/etc.)
  app.post(
    '/internal/cron/import/surcharges/us-all',
    {
      preHandler: adminGuard,
      schema: {
        body: z.object({ batchSize: z.coerce.number().int().min(1).max(20000).optional() }),
      },
      config: { importMeta: { source: 'US', job: 'surcharges:us-all' } },
    },
    async (req, reply) => {
      const { batchSize } = (req.body ?? {}) as { batchSize?: number };
      const importId = (req as any).importRunId as string | undefined;
      const res = await importAllUsSurcharges({ batchSize, importId });

      return reply.send(res);
    }
  );
}
