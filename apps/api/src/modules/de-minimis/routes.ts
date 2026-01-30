import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import {
  DeMinimisEvalBodySchema,
  DeMinimisEvalResponseSchema,
  DeMinimisThresholdQuerySchema,
  DeMinimisThresholdResponseSchema,
} from '@clearcost/types';
import { getDeMinimis } from './services/get-de-minimis.js';
import { evaluateDeMinimis } from './services/evaluate.js';

export default function deMinimisRoutes(app: FastifyInstance) {
  // GET /v1/de-minimis?dest=US&on=2025-01-31
  app.get<{
    Querystring: z.infer<typeof DeMinimisThresholdQuerySchema>;
    Reply: z.infer<typeof DeMinimisThresholdResponseSchema>;
  }>(
    '/',
    {
      preHandler: app.requireApiKey(['de-minimis:read']),
      schema: {
        querystring: DeMinimisThresholdQuerySchema,
        response: { 200: DeMinimisThresholdResponseSchema },
      },
      config: { rateLimit: { max: 240, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { dest, on } = DeMinimisThresholdQuerySchema.parse(req.query);
      const data = await getDeMinimis(dest.toUpperCase(), on ?? new Date());
      return reply.send(data);
    }
  );

  // POST /v1/de-minimis/evaluate
  app.post<{
    Body: z.infer<typeof DeMinimisEvalBodySchema>;
    Reply: z.infer<typeof DeMinimisEvalResponseSchema>;
  }>(
    '/evaluate',
    {
      preHandler: app.requireApiKey(['de-minimis:write']),
      schema: { body: DeMinimisEvalBodySchema, response: { 200: DeMinimisEvalResponseSchema } },
      config: { rateLimit: { max: 240, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { dest, goodsDest, freightDest, fxAsOf } = DeMinimisEvalBodySchema.parse(req.body);
      const out = await evaluateDeMinimis({
        dest: dest.toUpperCase(),
        goodsDest,
        freightDest,
        fxAsOf: fxAsOf ?? new Date(),
      });
      return reply.send(out);
    }
  );
}
