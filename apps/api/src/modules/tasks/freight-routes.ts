import { FastifyInstance } from 'fastify';
import { fetchJSON } from './common.js';
import { importFreightCards } from '../freight/services/import-cards.js';

type FreightStep = { uptoQty: number; pricePerUnit: number };
type FreightCardRow = {
  origin: string;
  dest: string;
  mode: 'air' | 'sea';
  unit: 'kg' | 'm3';
  currency: string;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  minCharge?: number;
  priceRounding?: number;
  volumetricDivisor?: number;
  notes?: string;
  steps: FreightStep[];
};

export default function freightRoutes(app: FastifyInstance) {
  app.post(
    '/internal/cron/import/freight',
    {
      preHandler: app.requireApiKey(['tasks:freight:import-json']),
      config: { importMeta: { source: 'FILE', job: 'freight:json' } },
    },
    async (req, reply) => {
      const rows = await fetchJSON<FreightCardRow[]>('freight/freight-cards.json');

      const res = await importFreightCards(rows, {
        importId: req.importCtx?.runId,
        makeSourceRef: (c) =>
          `file:freight/freight-cards.json:${c.origin}-${c.dest}:${c.mode}/${c.unit}:ef=${new Date(c.effectiveFrom).toISOString().slice(0, 10)}`,
      });

      return reply.send(res);
    }
  );
}
