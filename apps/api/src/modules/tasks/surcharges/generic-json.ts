import { FastifyInstance } from 'fastify';
import { adminGuard, fetchJSON } from '../common.js';
import { SurchargeInsert } from '@clearcost/types';
import { batchUpsertSurchargesFromStream } from '../../surcharges/utils/batch-upsert.js';

export default function surchargeJsonRoute(app: FastifyInstance) {
  app.post(
    '/internal/cron/import/surcharges',
    {
      preHandler: adminGuard,
      config: { importMeta: { source: 'file', job: 'surcharges:json' } },
    },
    async (req, reply) => {
      const path = 'surcharges/surcharges.json';
      const rows = await fetchJSON<SurchargeInsert[]>(path);

      const importId = (req as any).importRunId as string | undefined;

      const res = await batchUpsertSurchargesFromStream(rows, {
        importId,
        makeSourceRef: () => `file:${path}`,
        batchSize: 5000,
      });

      return reply.send(res);
    }
  );
}
