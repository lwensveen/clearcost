import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { withIdempotency } from '../../lib/idempotency.js';
import { importDutyRates } from './services/import-duty-rates.js';
import { DutyRateInsert, DutyRateInsertSchema, HeaderSchema } from '@clearcost/types';

const BodySchema = z.array(DutyRateInsertSchema).min(1).max(50_000);

const ReplySchema = z.object({ ok: z.literal(true), count: z.number().int().nonnegative() });

const QuerySchema = z.object({
  dryRun: z.coerce.boolean().default(false),
  source: z.string().min(1).max(40).optional(),
});

export default function dutyRoutes(app: FastifyInstance) {
  app.post<{
    Body: DutyRateInsert[];
    Headers: z.infer<typeof HeaderSchema>;
    Querystring: z.infer<typeof QuerySchema>;
    Reply: z.infer<typeof ReplySchema>;
  }>(
    '/import',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        headers: HeaderSchema,
        querystring: QuerySchema,
        body: BodySchema,
        response: { 200: ReplySchema },
      },
      config: {
        importMeta: { importSource: 'MANUAL', job: 'duties:json' },
        rateLimit: { max: 30, timeWindow: '1 minute' },
      },
    },
    async (req, reply) => {
      const headers = HeaderSchema.parse(req.headers);
      const { dryRun, source } = QuerySchema.parse(req.query);
      const rows = BodySchema.parse(req.body);

      if (source && req.routeOptions?.config?.importMeta) {
        (req.routeOptions.config.importMeta as any).source = source;
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
