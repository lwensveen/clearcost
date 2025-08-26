import { FastifyInstance } from 'fastify';
import { DutyRateInsert } from '@clearcost/types';
import { adminGuard, fetchJSON } from '../common.js';
import { importDutyRates } from '../../duty-rates/services/import-duty-rates.js';

export default function dutyJsonRoute(app: FastifyInstance) {
  // Duty rates: JSON file (manual)
  app.post(
    '/internal/cron/import/duties',
    {
      preHandler: adminGuard,
      config: { importMeta: { source: 'file', job: 'duties:json' } },
    },
    async (_req, reply) => {
      const rows = await fetchJSON<DutyRateInsert[]>('duties/duty-rates.json');

      const mapped: DutyRateInsert[] = rows
        .map((r) => ({
          dest: String(r.dest).toUpperCase(),
          hs6: String(r.hs6).slice(0, 6),
          ratePct: r.ratePct,
          rule: r.rule,
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
