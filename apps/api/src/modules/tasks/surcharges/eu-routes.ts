import { FastifyInstance } from 'fastify';
import { adminGuard } from '../common.js';
import { importEuTradeRemediesAsSurcharges } from '../../surcharges/services/eu/import-remedies.js';

export default function surchargeEuRoutes(app: FastifyInstance) {
  app.post(
    '/internal/cron/import/surcharges/eu-remedies',
    {
      preHandler: adminGuard,

      config: { importMeta: { source: 'TARIC', job: 'surcharges:eu-remedies' } },
    },
    async (req, reply) => {
      // env → list of TARIC measure type ids that represent trade remedies
      const raw = (process.env.EU_TARIC_REMEDY_TYPES ?? '').trim();
      const measureTypeIds = raw
        ? raw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      const importId = req.importCtx?.runId;

      const res = await importEuTradeRemediesAsSurcharges({
        measureTypeIds,
        importId,
      });

      return reply.send(res);
    }
  );
}
