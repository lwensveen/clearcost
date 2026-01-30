import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { importDeMinimisFromZonos } from '../de-minimis/services/import-from-zonos.js';
import { importDeMinimisFromOfficial } from '../de-minimis/services/import-official.js';
import { seedDeMinimisBaseline } from '../de-minimis/services/import-baseline.js';
import { TasksDeMinimisImportBodySchema } from '@clearcost/types';

const Body = TasksDeMinimisImportBodySchema;

const toMidnightUTC = (d: Date) => new Date(d.toISOString().slice(0, 10));

export default function deMinimisTaskRoutes(app: FastifyInstance) {
  // Zonos (scraped) — convenience source
  app.post<{ Body: z.infer<typeof Body> }>(
    '/cron/de-minimis/import-zonos',
    {
      preHandler: app.requireApiKey(['tasks:de-minimis:import-zonos']),
      schema: { body: Body.optional() },
      config: { importMeta: { importSource: 'ZONOS', job: 'de-minimis:import-zonos' } },
    },
    async (req, reply) => {
      const { effectiveOn } = Body.parse(req.body ?? {});
      const eff = toMidnightUTC(effectiveOn ?? new Date());

      const result = await importDeMinimisFromZonos(eff);
      return reply.send(result);
    }
  );

  // Official (primary) — EU/GB/US etc. from gov sources
  app.post(
    '/cron/de-minimis/import-official',
    {
      preHandler: app.requireApiKey(['tasks:de-minimis:import-official']),
      config: { importMeta: { importSource: 'OFFICIAL', job: 'de-minimis:import-official' } },
    },
    async (_req, reply) => {
      const result = await importDeMinimisFromOfficial();
      return reply.send(result);
    }
  );

  // Seed baseline defaults (idempotent upserts)
  app.post<{ Body: z.infer<typeof Body> }>(
    '/cron/de-minimis/seed-baseline',
    {
      preHandler: app.requireApiKey(['tasks:de-minimis:seed-baseline']),
      schema: { body: Body.optional() },
      config: { importMeta: { importSource: 'BASELINE', job: 'de-minimis:seed' } },
    },
    async (req, reply) => {
      const { effectiveOn } = Body.parse(req.body ?? {});
      const eff = toMidnightUTC(effectiveOn ?? new Date());

      const result = await seedDeMinimisBaseline(eff);
      return reply.send(result);
    }
  );
}
