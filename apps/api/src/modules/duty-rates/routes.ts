import type { FastifyInstance } from 'fastify';
import { withIdempotency } from '../../lib/idempotency.js';
import { importDutyRates } from './services/import-duty-rates.js';
import { z } from 'zod/v4';
import {
  DutyRateInsert,
  DutyRatesImportBodySchema,
  DutyRatesImportQuerySchema,
  DutyRatesImportResponseSchema,
  IdempotencyHeaderSchema,
} from '@clearcost/types';

export default function dutyRoutes(app: FastifyInstance) {
  app.post<{
    Body: DutyRateInsert[];
    Headers: z.infer<typeof IdempotencyHeaderSchema>;
    Querystring: z.infer<typeof DutyRatesImportQuerySchema>;
    Reply: z.infer<typeof DutyRatesImportResponseSchema>;
  }>(
    '/import',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        headers: IdempotencyHeaderSchema,
        querystring: DutyRatesImportQuerySchema,
        body: DutyRatesImportBodySchema,
        response: { 200: DutyRatesImportResponseSchema },
      },
      config: {
        importMeta: { importSource: 'MANUAL', job: 'duties:json' },
        rateLimit: { max: 30, timeWindow: '1 minute' },
      },
    },
    async (req, reply) => {
      const headers = IdempotencyHeaderSchema.parse(req.headers);
      const { dryRun, source } = DutyRatesImportQuerySchema.parse(req.query);
      const rows = DutyRatesImportBodySchema.parse(req.body);

      if (source && req.routeOptions?.config?.importMeta) {
        req.routeOptions.config.importMeta.source = source;
      }

      const idem = headers['idempotency-key'] ?? headers['x-idempotency-key']!;
      const ns = `import:duties:${req.apiKey!.ownerId}`;

      if (dryRun) {
        return reply.send({ ok: true as const, count: rows.length });
      }

      const out = await withIdempotency(ns, idem, { count: rows.length }, async () => {
        const res = await importDutyRates(rows);
        return { ok: true as const, count: res?.count ?? rows.length };
      });

      return reply.send(out);
    }
  );
}
