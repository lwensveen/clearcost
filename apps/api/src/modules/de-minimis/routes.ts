import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { getDeMinimis } from './services/get-de-minimis.js';
import { evaluateDeMinimis } from './services/evaluate.js';

const ThresholdQuery = z.object({
  dest: z.string().length(2), // ISO-2 country code
  on: z.coerce.date().optional(), // defaults to today (UTC day window)
});

const EvalBody = z.object({
  dest: z.string().length(2), // ISO-2 country code
  // Values are already in destination currency (per your service contract)
  goodsDest: z.number().nonnegative(),
  freightDest: z.number().nonnegative().default(0),
  fxAsOf: z.coerce.date().optional(), // defaults to now if omitted
});

const ThresholdResponse = z.object({
  duty: z
    .object({
      currency: z.string().length(3),
      value: z.number(),
      deMinimisBasis: z.enum(['INTRINSIC', 'CIF']),
    })
    .nullable(),
  vat: z
    .object({
      currency: z.string().length(3),
      value: z.number(),
      deMinimisBasis: z.enum(['INTRINSIC', 'CIF']),
    })
    .nullable(),
});

const EvalResponse = z.object({
  duty: z
    .object({
      thresholdDest: z.number(),
      deMinimisBasis: z.enum(['INTRINSIC', 'CIF']),
      under: z.boolean(),
    })
    .optional(),
  vat: z
    .object({
      thresholdDest: z.number(),
      deMinimisBasis: z.enum(['INTRINSIC', 'CIF']),
      under: z.boolean(),
    })
    .optional(),
  suppressDuty: z.boolean(),
  suppressVAT: z.boolean(),
});

export default function deMinimisRoutes(app: FastifyInstance) {
  // GET /v1/de-minimis?dest=US&on=2025-01-31
  app.get<{
    Querystring: z.infer<typeof ThresholdQuery>;
    Reply: z.infer<typeof ThresholdResponse>;
  }>(
    '/',
    {
      preHandler: app.requireApiKey(['de-minimis:read']),
      schema: { querystring: ThresholdQuery, response: { 200: ThresholdResponse } },
      config: { rateLimit: { max: 240, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { dest, on } = ThresholdQuery.parse(req.query);
      const data = await getDeMinimis(dest.toUpperCase(), on ?? new Date());
      return reply.send(data);
    }
  );

  // POST /v1/de-minimis/evaluate
  app.post<{ Body: z.infer<typeof EvalBody>; Reply: z.infer<typeof EvalResponse> }>(
    '/evaluate',
    {
      preHandler: app.requireApiKey(['de-minimis:write']),
      schema: { body: EvalBody, response: { 200: EvalResponse } },
      config: { rateLimit: { max: 240, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { dest, goodsDest, freightDest, fxAsOf } = EvalBody.parse(req.body);
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
