import { FastifyInstance } from 'fastify';
import { fetchJSONWithArtifact } from '../common.js';
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
      const artifact = await fetchJSONWithArtifact<SurchargeInsert[]>(path);
      if (req.importCtx) {
        req.importCtx.runPatch = {
          ...req.importCtx.runPatch,
          sourceUrl: artifact.sourceUrl,
          fileHash: artifact.fileHash,
          fileBytes: artifact.fileBytes,
        };
      }
      const rows = artifact.data;

      const res = await batchUpsertSurchargesFromStream(rows, {
        importId: req.importCtx?.runId,
        makeSourceRef: () => `file:${path}`,
        batchSize: 5000,
      });

      return reply.send(res);
    }
  );
}
