import Fastify from 'fastify';
import apiKeyRoutes from './modules/api-keys/routes.js';
import classifyRoutes from './modules/classify/routes.js';
import cors from '@fastify/cors';
import dateSerializer from './plugins/date-serializer.js';
import freightRoutes from './modules/freight/routes.js';
import fxRoutes from './modules/fx/routes.js';
import healthRoutes from './modules/health/routes.js';
import hsRoutes from './modules/hs-codes/routes.js';
import quoteRoutes from './modules/quotes/routes.js';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import surchargesRoutes from './modules/surcharges/routes.js';
import swaggerPlugin from './plugins/swagger.js';
import usagePlugin from './plugins/api-usage.js';
import vatRoutes from './modules/vat/routes.js';
import webhookRoutes from './modules/webhooks/routes.js';
import { apiKeyAuthPlugin } from './plugins/api-key-auth.js';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import tasksRoutes from './modules/tasks/routes.js';

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
  app.register(usagePlugin);

  app.register(healthRoutes);

  app.register(apiKeyRoutes, { prefix: '/v1/api-keys' });
  app.register(classifyRoutes, { prefix: '/v1/classify' });
  app.register(freightRoutes, { prefix: '/v1/freight' });
  app.register(fxRoutes, { prefix: '/v1/fx' });
  app.register(hsRoutes, { prefix: '/v1/hs-codes' });
  app.register(quoteRoutes, { prefix: '/v1/quotes' });
  app.register(surchargesRoutes, { prefix: '/v1/surcharges' });
  app.register(vatRoutes, { prefix: '/v1/vat' });
  app.register(webhookRoutes, { prefix: '/v1/webhooks' });
  app.register(tasksRoutes);

  return app;
}
