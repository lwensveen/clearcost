import { FastifyInstance } from 'fastify';
import { importUkTradeRemediesAsSurcharges } from '../../surcharges/services/uk/import-remedies.js';

export default function surchargeUkRoutes(app: FastifyInstance) {
  app.post(
    '/internal/cron/import/surcharges/uk-remedies',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      config: { importMeta: { source: 'UK_TT', job: 'surcharges:uk-remedies' } },
    },
    async (req, reply) => {
      const importId = req.importCtx?.runId;

      const measureTypeIds = (process.env.UK_REMEDY_MEASURE_TYPES ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await importUkTradeRemediesAsSurcharges({
        measureTypeIds,
        importId,
        batchSize: 5000,
      });

      return reply.send(res);
    }
  );
}
