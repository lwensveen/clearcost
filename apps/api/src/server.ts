import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import swaggerPlugin from './plugins/swagger.js';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import dateSerializer from './plugins/date-serializer.js';
import { apiKeyAuthPlugin } from './plugins/api-key-auth.js';
import rateLimit from '@fastify/rate-limit';

export async function buildServer() {
  const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(sensible);
  app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization', 'x-admin-token', 'idempotency-key'],
    credentials: true,
  });
  app.register(swaggerPlugin);
  app.register(dateSerializer);
  app.register(apiKeyAuthPlugin);
  app.register(rateLimit, { global: false });

  app.get('/health', async () => ({ ok: true, service: 'clearcost-api' }));

  return app;
}
