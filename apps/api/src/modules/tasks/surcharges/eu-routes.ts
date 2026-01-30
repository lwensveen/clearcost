import { FastifyInstance } from 'fastify';
import { importEuTradeRemediesAsSurcharges } from '../../surcharges/services/eu/import-remedies.js';
import { TasksSurchargeEuBodySchema } from '@clearcost/types';

export default function surchargeEuRoutes(app: FastifyInstance) {
  const Body = TasksSurchargeEuBodySchema;

  app.post(
    '/cron/import/surcharges/eu-remedies',
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
