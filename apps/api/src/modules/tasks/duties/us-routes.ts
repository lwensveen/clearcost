import { FastifyInstance } from 'fastify';
import { adminGuard } from '../common.js';
import { importUsMfn } from '../../duty-rates/services/us/import-from-hts.js';
import { importUsPreferential } from '../../duty-rates/services/us/import-preferential.js';

export default function usDutyRoutes(app: FastifyInstance) {
  // US MFN (Column 1 “General” from HTS)
  app.post(
    '/internal/cron/import/duties/us-mfn',
    {
      preHandler: adminGuard,
      config: { importMeta: { source: 'USITC_HTS', job: 'duties:us-mfn' } },
    },
    async (req, reply) => {
      const importId = (req as any).importRunId as string | undefined;
      const res = await importUsMfn({ importId });
      return reply.send(res);
    }
  );

  // US Preferential (Column 1 “Special” from HTS)
  app.post(
    '/internal/cron/import/duties/us-preferential',
    {
      preHandler: adminGuard,
      config: { importMeta: { source: 'USITC_HTS', job: 'duties:us-fta' } },
    },
    async (req, reply) => {
      const importId = (req as any).importRunId as string | undefined;
      const res = await importUsPreferential({ importId });
      return reply.send(res);
    }
  );
}
