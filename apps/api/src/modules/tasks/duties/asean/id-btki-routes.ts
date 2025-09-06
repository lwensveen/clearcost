import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { crawlBtkiPdfs } from '../../../duty-rates/services/asean/id/btki-crawl.js';

export default function idBtkiRoutes(app: FastifyInstance) {
  const Body = z.object({
    startUrl: z.string().url().optional(), // falls back to env
    maxDepth: z.coerce.number().int().min(0).max(5).optional(),
    concurrency: z.coerce.number().int().min(1).max(8).optional(),
    outDir: z.string().optional(),
    includeHints: z.array(z.string()).optional(),
    excludeHints: z.array(z.string()).optional(),
  });

  app.post(
    '/internal/cron/id/btki/crawl',
    {
      preHandler: app.requireApiKey(['tasks:duties:id']),
      schema: { body: Body },
      config: { importMeta: { importSource: 'ID_BTKI', job: 'btki:crawl' } },
    },
    async (req, reply) => {
      const body = Body.parse(req.body ?? {});
      const startUrl =
        body.startUrl ?? process.env.ID_BTKI_START_URL ?? 'https://repository.beacukai.go.id/';
      const result = await crawlBtkiPdfs({
        startUrl,
        maxDepth: body.maxDepth ?? 1,
        concurrency: body.concurrency ?? 4,
        outDir: body.outDir ?? process.env.ID_BTKI_OUT_DIR,
        includeHints: body.includeHints ?? ['btki', 'bab', 'chapter', 'pmk', 'tarif'],
        excludeHints: body.excludeHints ?? [],
      });
      return reply.send(result);
    }
  );
}
