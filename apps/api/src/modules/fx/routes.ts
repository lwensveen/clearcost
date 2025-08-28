import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { withIdempotency } from '../../lib/idempotency.js';
import { refreshFx } from '../../lib/refresh-fx.js';
import { HeaderSchema } from '@clearcost/types';

const ReplySchema = z.object({
  base: z.string(),
  fxAsOf: z.string(), // ISO8601
  attemptedInserts: z.number().int().nonnegative(),
});

export default function fxRoutes(app: FastifyInstance) {
  // TODO add admin?
  // POST /v1/fx/refresh  (requires API key with fx:write)
  app.post<{
    Headers: z.infer<typeof HeaderSchema>;
    Reply: z.infer<typeof ReplySchema>;
  }>(
    '/refresh',
    {
      preHandler: app.requireApiKey(['fx:write']),
      schema: {
        headers: HeaderSchema,
        response: { 200: ReplySchema },
      },
      // Prometheus & provenance auto-wired
      config: {
        importMeta: { importSource: 'ECB', job: 'fx:refresh' },
        rateLimit: { max: 12, timeWindow: '1 minute' },
      },
    },
    async (req, reply) => {
      const headers = HeaderSchema.parse(req.headers);
      const idem = headers['idempotency-key'] ?? headers['x-idempotency-key']!;
      const ns = `fx:refresh:${req.apiKey!.ownerId}`;

      const result = await withIdempotency(ns, idem, {}, async () => {
        const r = await refreshFx(); // expected: { base, fxAsOf, inserted }
        return {
          base: r.base,
          fxAsOf: typeof r.fxAsOf === 'string' ? r.fxAsOf : (r.fxAsOf as Date).toISOString(),
          attemptedInserts: Number(r.inserted ?? 0),
        };
      });

      return reply.send(result);
    }
  );
}
