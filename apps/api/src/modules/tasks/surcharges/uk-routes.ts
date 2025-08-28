import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { importUkTradeRemediesAsSurcharges } from '../../surcharges/services/uk/import-remedies.js';

export default function surchargeUkRoutes(app: FastifyInstance) {
  const Body = z.object({
    // Optional: override env-provided measure types
    measureTypeIds: z.array(z.string().min(1)).optional(),
    batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
  });

  app.post(
    '/internal/cron/import/surcharges/uk-remedies',
    {
      preHandler: app.requireApiKey(['tasks:surcharges:uk-remedies']),
      schema: { body: Body.optional() },
      config: { importMeta: { source: 'UK_TT', job: 'surcharges:uk-remedies' } },
    },
    async (req, reply) => {
      const { measureTypeIds: bodyTypes, batchSize } = Body.parse(req.body ?? {});
      const importId = req.importCtx?.runId;

      const envTypes = (process.env.UK_REMEDY_MEASURE_TYPES ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const measureTypeIds = bodyTypes && bodyTypes.length ? bodyTypes : envTypes;

      const res = await importUkTradeRemediesAsSurcharges({
        measureTypeIds,
        importId,
        batchSize: batchSize ?? 5000,
      });

      return reply.send(res);
    }
  );
}
