import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { importEuTradeRemediesAsSurcharges } from '../../surcharges/services/eu/import-remedies.js';

export default function surchargeEuRoutes(app: FastifyInstance) {
  const Body = z.object({
    // Optional override; if omitted we read from EU_TARIC_REMEDY_TYPES env (comma-separated)
    measureTypeIds: z.array(z.string().min(1)).optional(),
  });

  app.post(
    '/internal/cron/import/surcharges/eu-remedies',
    {
      preHandler: app.requireApiKey(['tasks:surcharges:eu-remedies']),
      schema: { body: Body },
      config: { importMeta: { importSource: 'TARIC', job: 'surcharges:eu-remedies' } },
    },
    async (req, reply) => {
      const { measureTypeIds: override } = Body.parse(req.body ?? {});
      const measureTypeIds =
        override ??
        (process.env.EU_TARIC_REMEDY_TYPES ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

      const res = await importEuTradeRemediesAsSurcharges({
        measureTypeIds,
        importId: req.importCtx?.runId,
      });

      return reply.send(res);
    }
  );
}
