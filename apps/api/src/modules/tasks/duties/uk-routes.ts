import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { batchUpsertDutyRatesFromStream } from '../../duty-rates/utils/batch-upsert.js';
import { streamUkMfnDutyRates } from '../../duty-rates/services/uk/mfn.js';
import { streamUkPreferentialDutyRates } from '../../duty-rates/services/uk/preferential.js';

export default function ukDutyRoutes(app: FastifyInstance) {
  // UK MFN (streaming)
  app.post(
    '/internal/cron/import/duties/uk-mfn',
    {
      preHandler: app.requireApiKey(['tasks:duties:uk']),
      schema: {
        body: z.object({
          hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
          batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
        }),
      },
      config: { importMeta: { source: 'UK_TT', job: 'duties:uk-mfn' } },
    },
    async (req, reply) => {
      const Body = z.object({
        hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
        batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
      });
      const { hs6, batchSize } = Body.parse(req.body ?? {});
      const importId = req.importCtx?.runId;

      const res = await batchUpsertDutyRatesFromStream(streamUkMfnDutyRates({ hs6List: hs6 }), {
        batchSize,
        importId,
        makeSourceRef: (row) => `uk:tt:erga-omnes:hs6=${row.hs6}`,
      });

      return reply.send(res);
    }
  );

  // UK Preferential (streaming)
  app.post(
    '/internal/cron/import/duties/uk-fta',
    {
      preHandler: app.requireApiKey(['tasks:duties:uk']),
      schema: {
        body: z.object({
          hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
          partners: z.array(z.string()).optional(), // numeric geo IDs, ISO2, or name fragments
          batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
        }),
      },
      config: { importMeta: { source: 'UK_TT', job: 'duties:uk-fta' } },
    },
    async (req, reply) => {
      const Body = z.object({
        hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
        partners: z.array(z.string()).optional(),
        batchSize: z.coerce.number().int().min(1).max(20_000).optional(),
      });
      const { hs6, partners, batchSize } = Body.parse(req.body ?? {});
      const importId = req.importCtx?.runId;

      const res = await batchUpsertDutyRatesFromStream(
        streamUkPreferentialDutyRates({ hs6List: hs6, partners }),
        {
          batchSize,
          importId,
          makeSourceRef: (row) => `uk:tt:pref:partner=${row.partner ?? 'group'}:hs6=${row.hs6}`,
        }
      );

      return reply.send(res);
    }
  );
}
