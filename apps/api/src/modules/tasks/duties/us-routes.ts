import { FastifyInstance } from 'fastify';
import { importUsMfn } from '../../duty-rates/services/us/import-mfn.js';
import { importUsPreferential } from '../../duty-rates/services/us/import-preferential.js';
import { TasksDutyUsBodySchema } from '@clearcost/types';

export default function usDutyRoutes(app: FastifyInstance) {
  // US MFN (Column 1 “General” from HTS)
  app.post(
    '/cron/import/duties/us-mfn',
    {
      preHandler: app.requireApiKey(['tasks:duties:us:mfn']),
      schema: { body: TasksDutyUsBodySchema },
      config: {
        importMeta: {
          importSource: 'USITC_HTS',
          job: 'duties:us-mfn-official',
          sourceKey: 'duties.us.usitc.base',
        },
      },
    },
    async (req, reply) => {
      const { baseUrl, csvUrl } = TasksDutyUsBodySchema.parse(req.body ?? {});
      const importId = req.importCtx?.runId;
      const res = await importUsMfn({ importId, baseUrl, csvUrl });
      return reply.send(res);
    }
  );

  // US Preferential (Column 1 “Special” from HTS)
  app.post(
    '/cron/import/duties/us-preferential',
    {
      preHandler: app.requireApiKey(['tasks:duties:us:fta']),
      schema: { body: TasksDutyUsBodySchema },
      config: {
        importMeta: {
          importSource: 'USITC_HTS',
          job: 'duties:us-fta-official',
          sourceKey: 'duties.us.usitc.base',
        },
      },
    },
    async (req, reply) => {
      const { baseUrl, csvUrl } = TasksDutyUsBodySchema.parse(req.body ?? {});
      const importId = req.importCtx?.runId;
      const res = await importUsPreferential({ importId, baseUrl, csvUrl });
      return reply.send(res);
    }
  );
}
