import { FastifyInstance } from 'fastify';
import { adminGuard, fetchJSON } from './common.js';
import { importFreightCards } from '../freight/services/import-cards.js';

type FreightStep = { uptoQty: number; pricePerUnit: number };
type FreightCardRow = {
  origin: string;
  dest: string;
  mode: 'air' | 'sea';
  unit: 'kg' | 'm3';
  currency?: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  minCharge?: number;
  priceRounding?: number;
  volumetricDivisor?: number;
  notes?: string | null;
  steps: FreightStep[];
};

export default function freightRoutes(app: FastifyInstance) {
  app.post(
    '/internal/cron/import/freight',
    {
      preHandler: adminGuard,
      config: { importMeta: { source: 'file', job: 'freight:json' } },
    },
    async (req, reply) => {
      const rows = await fetchJSON<FreightCardRow[]>('freight/freight-cards.json');

      const res = await importFreightCards(rows as any, {
        importId: (req as any).importRunId,
        makeSourceRef: (c) =>
          `file:freight/freight-cards.json:${c.origin}-${c.dest}:${c.mode}/${c.unit}:ef=${new Date(c.effectiveFrom).toISOString().slice(0, 10)}`,
      });

      return reply.send(res);
    }
  );
}
