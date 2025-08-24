import type { FastifyInstance } from 'fastify';
import z from 'zod/v4';
import { quoteInputSchema, QuoteResponseSchema } from './schemas.js';
import { quoteLandedCost } from './services.js';

export default function quoteRoutes(app: FastifyInstance) {
  app.post<{
    Body: z.infer<typeof quoteInputSchema>;
    Reply: z.infer<typeof QuoteResponseSchema>;
  }>(
    '/',
    {
      preHandler: app.requireApiKey?.(['quotes:calc']),
      schema: {
        body: quoteInputSchema,
        response: { 200: QuoteResponseSchema },
      },
    },
    async (req, reply) => {
      const out = await quoteLandedCost(req.body);
      return reply.send(out);
    }
  );
}
