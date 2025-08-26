import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { importDutyRates } from './services/import-duty-rates.js';
import { DutyRateInsert, DutyRateInsertSchema } from '@clearcost/types';

export default function dutyRoutes(app: FastifyInstance) {
  app.post<{ Body: DutyRateInsert[] }>(
    '/import',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        body: DutyRateInsertSchema,
        response: { 200: z.object({ ok: z.literal(true), count: z.number() }) },
      },
    },
    async (req) => importDutyRates(req.body)
  );
}
