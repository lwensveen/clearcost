import { FastifyInstance } from 'fastify';
import { assertNonEmptyImportRows, fetchJSONWithArtifact } from './common.js';
import { importFreightCards } from '../freight/services/import-cards.js';

type FreightStep = { uptoQty: number; pricePerUnit: number };
type FreightCardRow = {
  origin: string;
  dest: string;
  freightMode: 'air' | 'sea';
  freightUnit: 'kg' | 'm3';
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
    '/cron/import/freight',
    {
      preHandler: app.requireApiKey(['tasks:freight:import-json']),
      config: { importMeta: { importSource: 'FILE', job: 'freight:json' } },
    },
    async (req, reply) => {
      const artifact = await fetchJSONWithArtifact<FreightCardRow[]>('freight/freight-cards.json');
      if (req.importCtx) {
        req.importCtx.runPatch = {
          ...req.importCtx.runPatch,
          sourceUrl: artifact.sourceUrl,
          fileHash: artifact.fileHash,
          fileBytes: artifact.fileBytes,
        };
      }
      const rows = artifact.data;
      assertNonEmptyImportRows(rows, {
        job: 'freight:json',
        sourceUrl: artifact.sourceUrl,
      });

      const res = await importFreightCards(rows, {
        importId: req.importCtx?.runId,
        makeSourceRef: (c) =>
          `file:freight/freight-cards.json:${c.origin}-${c.dest}:${c.freightMode}/${c.freightUnit}:ef=${new Date(c.effectiveFrom).toISOString().slice(0, 10)}`,
      });

      return reply.send(res);
    }
  );
}
