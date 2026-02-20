import { FastifyInstance } from 'fastify';
import { crawlBtkiPdfs } from '../../../duty-rates/services/asean/id/btki-crawl.js';
import { TasksDutyIdBtkiCrawlBodySchema } from '@clearcost/types';

export default function idBtkiRoutes(app: FastifyInstance) {
  const Body = TasksDutyIdBtkiCrawlBodySchema;

  app.post(
    '/cron/id/btki/crawl',
    {
      preHandler: app.requireApiKey(['tasks:duties:id']),
      schema: { body: Body },
      config: {
        importMeta: {
          importSource: 'ID_BTKI',
          job: 'btki:crawl',
          sourceKey: 'duties.id.btki.portal',
        },
      },
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
