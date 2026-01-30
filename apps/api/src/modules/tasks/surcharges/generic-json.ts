import { FastifyInstance } from 'fastify';
import { fetchJSON } from '../common.js';
import { SurchargeInsert, TasksSurchargeGenericJsonBodySchema } from '@clearcost/types';
import { batchUpsertSurchargesFromStream } from '../../surcharges/utils/batch-upsert.js';

export default function surchargeJsonRoute(app: FastifyInstance) {
  const Body = TasksSurchargeGenericJsonBodySchema;

  app.post(
    '/cron/import/surcharges',
    {
      preHandler: app.requireApiKey(['tasks:surcharges:json']),
      schema: { body: Body.optional() },
      config: { importMeta: { importSource: 'FILE', job: 'surcharges:json' } },
    },
    async (req, reply) => {
      const { path = 'surcharges/surcharges.json' } = Body.parse(req.body ?? {});
      const rows = await fetchJSON<SurchargeInsert[]>(path);

      const res = await batchUpsertSurchargesFromStream(rows, {
        importId: req.importCtx?.runId,
        makeSourceRef: () => `file:${path}`,
        batchSize: 5000,
      });

      return reply.send(res);
    }
  );
}
