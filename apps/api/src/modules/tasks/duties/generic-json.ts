import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { DutyRateInsert } from '@clearcost/types';
import { fetchJSON } from '../common.js';
import { importDutyRates } from '../../duty-rates/services/import-duty-rates.js';

export default function dutyJsonRoute(app: FastifyInstance) {
  // POST /internal/cron/import/duties — import duty rates from a JSON blob (manual)
  app.post(
    '/internal/cron/import/duties',
    {
      preHandler: app.requireApiKey(['tasks:duties:json']),
      schema: {
        response: {
          200: z.object({ ok: z.literal(true), count: z.number() }),
        },
      },
      config: { importMeta: { importSource: 'FILE', job: 'duties:json' } },
    },
    async (_req, reply) => {
      const rows = await fetchJSON<DutyRateInsert[]>('duties/duty-rates.json');

      const mapped: DutyRateInsert[] = rows
        .map((r) => ({
          dest: String(r.dest).toUpperCase(),
          hs6: String(r.hs6).slice(0, 6),
          ratePct: r.ratePct,
          dutyRule: r.dutyRule,
          currency: r.currency,
          effectiveFrom: r.effectiveFrom,
          effectiveTo: r.effectiveTo,
          notes: r.notes ?? null,
        }))
        .filter(Boolean) as DutyRateInsert[];

      const res = await importDutyRates(mapped);
      return reply.send(res);
    }
  );
}
