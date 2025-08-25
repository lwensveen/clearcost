import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { DutyRows, importDutyRates } from './services/import-duty-rates.js';

export default function dutyRoutes(app: FastifyInstance) {
  app.post<{ Body: z.infer<typeof DutyRows> }>(
    '/import',
    {
      preHandler: app.requireApiKey(['admin:rates']),
      schema: {
        body: DutyRows,
        response: { 200: z.object({ ok: z.literal(true), count: z.number() }) },
      },
    },
    async (req) => importDutyRates(req.body)
  );
}
