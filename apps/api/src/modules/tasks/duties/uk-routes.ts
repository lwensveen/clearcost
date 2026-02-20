import { FastifyInstance } from 'fastify';
import { batchUpsertDutyRatesFromStream } from '../../duty-rates/utils/batch-upsert.js';
import { streamUkMfnDutyRates } from '../../duty-rates/services/uk/mfn.js';
import { streamUkPreferentialDutyRates } from '../../duty-rates/services/uk/preferential.js';
import { TasksDutyHs6BatchBodySchema, TasksDutyHs6BatchPartnersBodySchema } from '@clearcost/types';

export default function ukDutyRoutes(app: FastifyInstance) {
  // UK MFN (streaming)
  app.post(
    '/cron/import/duties/uk-mfn',
    {
      preHandler: app.requireApiKey(['tasks:duties:uk']),
      schema: { body: TasksDutyHs6BatchBodySchema },
      config: {
        importMeta: {
          importSource: 'UK_TT',
          job: 'duties:uk-mfn',
          sourceKey: 'duties.uk.tariff.api_base',
        },
      },
    },
    async (req, reply) => {
      const { hs6, batchSize } = TasksDutyHs6BatchBodySchema.parse(req.body ?? {});
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
    '/cron/import/duties/uk-fta',
    {
      preHandler: app.requireApiKey(['tasks:duties:uk']),
      schema: { body: TasksDutyHs6BatchPartnersBodySchema },
      config: {
        importMeta: {
          importSource: 'UK_TT',
          job: 'duties:uk-fta',
          sourceKey: 'duties.uk.tariff.api_base',
        },
      },
    },
    async (req, reply) => {
      const { hs6, partners, batchSize } = TasksDutyHs6BatchPartnersBodySchema.parse(
        req.body ?? {}
      );
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
