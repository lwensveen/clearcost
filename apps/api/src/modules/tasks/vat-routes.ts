import { FastifyInstance } from 'fastify';
import { fetchVatRowsFromOfficialSources } from '../vat/services/fetch-vat-official.js';
import { importVatRules } from '../vat/services/import-vat.js';

export default function vatRoutes(app: FastifyInstance) {
  app.post(
    '/internal/cron/import/vat/auto',
    {
      preHandler: app.requireApiKey(['tasks:vat:auto']),
      config: { importMeta: { source: 'OECD/IMF', job: 'vat:auto' } },
    },
    async (req, reply) => {
      const rows = await fetchVatRowsFromOfficialSources();

      const importId = req.importCtx?.runId;

      const res = await importVatRules(rows, {
        importId,
        makeSourceRef: (r) => {
          const note = (r.notes ?? '').toLowerCase();
          const src = note.includes('oecd') ? 'oecd' : note.includes('imf') ? 'imf' : 'oecd_imf';
          return `${src}:vat:${r.dest}:${r.kind}`;
        },
      });

      return reply.send(res);
    }
  );
}
