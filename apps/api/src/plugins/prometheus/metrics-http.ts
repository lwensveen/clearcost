import fp from 'fastify-plugin';
import { collectDefaultMetrics, Counter, Histogram, register } from 'prom-client';
import type { FastifyInstance, FastifyRequest } from 'fastify';

function routeLabel(req: FastifyRequest) {
  return (req.routeOptions && (req.routeOptions as any).url) || (req as any).routerPath || req.url;
}

export default fp(async (app: FastifyInstance) => {
  collectDefaultMetrics({ register });

  const reqDuration = new Histogram({
    name: 'http_server_request_duration_seconds',
    help: 'HTTP request duration (seconds)',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  });

  const reqTotal = new Counter({
    name: 'http_server_requests_total',
    help: 'HTTP requests count',
    labelNames: ['method', 'route', 'status_code'] as const,
  });

  app.addHook('onRequest', async (req) => {
    // save the end() function returned by startTimer()
    (req as any)._prom_end = reqDuration.startTimer();
  });

  app.addHook('onResponse', async (req, reply) => {
    const method = req.method;
    const route = routeLabel(req);
    const status_code = String(reply.statusCode);

    reqTotal.inc({ method, route, status_code });

    const end = (req as any)._prom_end as undefined | ((labels?: Record<string, string>) => void);
    end?.({ method, route, status_code });
  });

  // Optional: skip exporting /metrics in metrics to avoid self-scrape noise
  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });
});
