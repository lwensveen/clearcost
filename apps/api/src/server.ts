import Fastify from 'fastify';
import apiKeyAdminRoutes from './modules/api-keys/routes/admin.js';
import apiKeySelfRoutes from './modules/api-keys/routes/self.js';
import billingRoutes from './modules/billing/routes.js';
import classifyRoutes from './modules/classify/routes.js';
import cors from '@fastify/cors';
import dateSerializer from './plugins/date-serializer.js';
import deMinimisRoutes from './modules/de-minimis/routes.js';
import dutyRatesRoutes from './modules/duty-rates/routes.js';
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
import metaRoutes from './modules/meta/routes.js';
import errorHandler from './plugins/error-handler.js';
import orgSelfSettingsRoutes from './modules/org-settings/routes.js';
import noticesRoutes from './modules/notices/routes.js';
import metricsRoutes from './modules/metrics/routes.js';

function parseTrustProxy(value?: string): boolean | number {
  if (!value) return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  const hops = Number(value);
  return Number.isFinite(hops) ? hops : false;
}

type BaseServerOptions = {
  enableCors: boolean;
  enableDocs: boolean;
  enableHttpMetrics: boolean;
  enableImportMetrics: boolean;
  enableImportInstrumentation: boolean;
};

async function buildBaseServer(options: BaseServerOptions) {
  const app = Fastify({
    logger: true,
    bodyLimit: 2 * 1024 * 1024,
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet, { contentSecurityPolicy: false });
  if (options.enableCors) {
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
  }

  await app.register(sensible);
  if (options.enableDocs) {
    await app.register(swaggerPlugin);
  }
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
  if (options.enableImportInstrumentation) {
    await app.register(importInstrumentation);
  }
  if (options.enableHttpMetrics) {
    await app.register(metricsHttp);
  }
  if (options.enableImportMetrics) {
    await app.register(importsRunning);
    await app.register(metricsImportHealth);
  }
  await app.register(planEnforcement);
  await app.register(planEntitlements);
  await app.register(usage);
  await app.register(errorHandler);

  return app;
}

export async function buildPublicServer() {
  const app = await buildBaseServer({
    enableCors: true,
    enableDocs: true,
    enableHttpMetrics: true,
    enableImportMetrics: false,
    enableImportInstrumentation: true,
  });

  // -----------------------
  // Public / low-scope API
  // -----------------------
  await app.register(healthPublicRoutes); // /healthz, /health
  await app.register(metaRoutes);

  await app.register(apiKeySelfRoutes, { prefix: '/v1/api-keys' });
  await app.register(billingRoutes, { prefix: '/v1/billing' });
  await app.register(classifyRoutes, { prefix: '/v1/classify' });
  await app.register(deMinimisRoutes, { prefix: '/v1/de-minimis' });
  await app.register(fxRoutes, { prefix: '/v1/fx' });
  await app.register(hsRoutes, { prefix: '/v1/hs-codes' });
  await app.register(manifestsRoutes, { prefix: '/v1/manifests' });
  await app.register(quoteRoutes, { prefix: '/v1/quotes' });
  await app.register(usagePublicRoutes, { prefix: '/v1/usage' });
  await app.register(orgSelfSettingsRoutes, { prefix: '/v1/orgs' });

  // --------------
  // Admin surfaces
  // --------------
  await app.register(apiKeyAdminRoutes, { prefix: '/v1/admin/api-keys' });
  await app.register(dutyRatesRoutes, { prefix: '/v1/admin/duty-rates' });
  await app.register(freightAdminRoutes, { prefix: '/v1/admin/freight' });
  await app.register(surchargesAdminRoutes, { prefix: '/v1/admin/surcharges' });
  await app.register(vatAdminRoutes, { prefix: '/v1/admin/vat' });
  await app.register(usageAdminRoutes, { prefix: '/v1/admin/usage' });
  await app.register(webhookAdminRoutes, { prefix: '/v1/admin/webhooks' });

  return app;
}

export async function buildInternalServer(
  opts: {
    enableImportMetrics?: boolean;
    enableImportInstrumentation?: boolean;
    enableHttpMetrics?: boolean;
  } = {}
) {
  const app = await buildBaseServer({
    enableCors: false,
    enableDocs: false,
    enableHttpMetrics: opts.enableHttpMetrics ?? true,
    enableImportMetrics: opts.enableImportMetrics ?? true,
    enableImportInstrumentation: opts.enableImportInstrumentation ?? true,
  });

  await app.register(healthPublicRoutes); // /healthz, /health
  app.get('/internal/healthz', async () => ({ ok: true, internal: true }));

  // Metrics remain on the internal server but do not require internal signing.
  await app.register(metricsRoutes); // /metrics (ops)

  await app.register(async (internal) => {
    internal.addHook('preHandler', internal.requireInternalSignature());
    await internal.register(healthAdminRoutes, { prefix: '/v1/admin/health' });
    await internal.register(noticesRoutes, { prefix: '/internal' });
    await internal.register(tasksRoutes, { prefix: '/internal' });
  });

  return app;
}
