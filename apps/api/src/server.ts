import Fastify from 'fastify';
import apiKeyAdminRoutes from './modules/api-keys/routes/admin.js';
import apiKeySelfRoutes from './modules/api-keys/routes/self.js';
import billingRoutes from './modules/billing/routes.js';
import classifyRoutes from './modules/classify/routes.js';
import cors from '@fastify/cors';
import dateSerializer from './plugins/date-serializer.js';
import deMinimisRoutes from './modules/de-minimis/routes.js';
import freightAdminRoutes from './modules/freight/routes/admin.js';
import fxRoutes from './modules/fx/routes.js';
import healthAdminRoutes from './modules/health/routes/admin.js';
import healthPublicRoutes from './modules/health/routes/public.js';
import helmet from '@fastify/helmet';
import hsRoutes from './modules/hs-codes/routes.js';
import importInstrumentation from './plugins/import-instrumentation.js';
import importsRunning from './plugins/prometheus/imports-running.js';
import manifestsRoutes from './modules/manifests/routes/index.js';
import metricsHttp from './plugins/prometheus/metrics-http.js';
import metricsImportHealth from './plugins/prometheus/metrics-import-health.js';
import planEnforcement from './plugins/plan-enforcement.js';
import planEntitlements from './plugins/plan-entitlements.js';
import quoteRoutes from './modules/quotes/routes.js';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import surchargesAdminRoutes from './modules/surcharges/routes/admin.js';
import swaggerPlugin from './plugins/swagger.js';
import tasksRoutes from './modules/tasks/index.js';
import usage from './plugins/api-usage.js';
import usageAdminRoutes from './modules/usage/routes/admin.js';
import usagePublicRoutes from './modules/usage/routes/public.js';
import vatAdminRoutes from './modules/vat/routes/admin.js';
import webhookAdminRoutes from './modules/webhooks/admin/routes.js';
import { apiKeyAuthPlugin } from './plugins/api-key-auth.js';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';

export async function buildServer() {
  const app = Fastify({
    logger: true,
    bodyLimit: 2 * 1024 * 1024,
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet, { contentSecurityPolicy: false });

  const ALLOWED_ORIGIN = process.env.WEB_ORIGIN; // e.g. https://app.clearcost.com
  await app.register(cors, {
    origin: ALLOWED_ORIGIN ? [ALLOWED_ORIGIN] : false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'authorization',
      'x-api-key',
      'content-type',
      'idempotency-key',
      'x-cc-ts',
      'x-cc-sig',
    ],
    maxAge: 600,
    credentials: false,
  });

  await app.register(sensible);
  await app.register(swaggerPlugin);
  await app.register(dateSerializer);
  await app.register(apiKeyAuthPlugin);

  // Global rate limit (API-key aware)
  await app.register(rateLimit, {
    global: true,
    max: Number(process.env.RATE_LIMIT_MAX ?? 600),
    timeWindow: process.env.RATE_LIMIT_WINDOW ?? '1 minute',
    keyGenerator: (req) => req.apiKey?.id ?? req.ip,
    ban: 0,
    allowList: [],
  });

  // Metrics & import instrumentation
  await app.register(importInstrumentation);
  await app.register(importsRunning);
  await app.register(metricsHttp);
  await app.register(metricsImportHealth);
  await app.register(planEnforcement);
  await app.register(planEntitlements);
  await app.register(usage);

  // -----------------------
  // Public / low-scope API
  // -----------------------
  await app.register(healthPublicRoutes); // /healthz, /health

  await app.register(apiKeySelfRoutes, { prefix: '/v1/api-keys' });
  await app.register(billingRoutes, { prefix: '/v1/billing' });
  await app.register(classifyRoutes, { prefix: '/v1/classify' });
  await app.register(deMinimisRoutes, { prefix: '/v1/de-minimis' });
  await app.register(fxRoutes, { prefix: '/v1/fx' });
  await app.register(hsRoutes, { prefix: '/v1/hs-codes' });
  await app.register(manifestsRoutes, { prefix: '/v1/manifests' });
  await app.register(quoteRoutes, { prefix: '/v1/quotes' });
  await app.register(usagePublicRoutes, { prefix: '/v1/usage' });

  // --------------
  // Admin surfaces
  // --------------
  await app.register(apiKeyAdminRoutes, { prefix: '/v1/admin/api-keys' });
  await app.register(freightAdminRoutes, { prefix: '/v1/admin/freight' });
  await app.register(surchargesAdminRoutes, { prefix: '/v1/admin/surcharges' });
  await app.register(vatAdminRoutes, { prefix: '/v1/admin/vat' });
  await app.register(healthAdminRoutes, { prefix: '/v1/admin/health' });
  await app.register(usageAdminRoutes, { prefix: '/v1/admin/usage' });
  await app.register(webhookAdminRoutes, { prefix: '/v1/admin/webhooks' });

  await app.register(tasksRoutes);

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, 'request_error');
    const status = err.statusCode ?? 500;
    if (status >= 500) return reply.code(500).send({ error: 'Internal Server Error' });
    reply.code(status).send({ error: err.message ?? 'Bad Request' });
  });

  return app;
}
