import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';

import { acquireRunLock, makeLockKey, releaseRunLock } from '../../lib/run-lock.js';
import { importDeMinimisFromZonos } from './services/import-from-zonos.js';
import { adminGuard } from '../tasks/common.js';
import { importDeMinimisFromOfficial } from './services/import-official.js';

const toMidnightUTC = (d: Date) => new Date(d.toISOString().slice(0, 10));

export default function deMinimisTaskRoutes(app: FastifyInstance) {
  const Body = z.object({
    effectiveOn: z.coerce.date().optional(),
  });

  // Zonos scraper
  app.post<{ Body: z.infer<typeof Body> }>(
    '/internal/cron/de-minimis/import-zonos',
    {
      preHandler: adminGuard,
      config: { importMeta: { source: 'ZONOS', job: 'de-minimis:import-zonos' } },
      schema: { body: Body },
    },
    async (req, reply) => {
      const eff = toMidnightUTC(Body.parse(req.body ?? {}).effectiveOn ?? new Date());
      const lockKey = makeLockKey(
        { source: 'ZONOS', job: 'de-minimis:import-zonos' },
        eff.toISOString().slice(0, 10)
      );

      const locked = await acquireRunLock(lockKey);
      if (!locked)
        return reply.code(409).send({ ok: false as const, reason: 'already_running', lockKey });

      try {
        const result = await importDeMinimisFromZonos(eff);
        return reply.send({ ...result, lockKey });
      } finally {
        await releaseRunLock(lockKey);
      }
    }
  );

  // Official sources
  app.post<{ Body: z.infer<typeof Body> }>(
    '/internal/cron/de-minimis/import-official',
    {
      preHandler: adminGuard,
      config: { importMeta: { source: 'OFFICIAL', job: 'de-minimis:official' } },
      schema: { body: Body },
    },
    async (req, reply) => {
      const eff = toMidnightUTC(Body.parse(req.body ?? {}).effectiveOn ?? new Date());
      const lockKey = makeLockKey(
        { source: 'OFFICIAL', job: 'de-minimis:official' },
        eff.toISOString().slice(0, 10)
      );

      const locked = await acquireRunLock(lockKey);
      if (!locked)
        return reply.code(409).send({ ok: false as const, reason: 'already_running', lockKey });

      try {
        const result = await importDeMinimisFromOfficial(eff);
        return reply.send({ ...result, lockKey });
      } finally {
        await releaseRunLock(lockKey);
      }
    }
  );
}
