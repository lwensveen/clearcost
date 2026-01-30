import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Counter, Histogram } from 'prom-client';
import { registry } from '../../lib/metrics.js';

function routeLabel(req: FastifyRequest) {
  return req.routeOptions?.url ?? req.url;
}

export default fp(
  async (app: FastifyInstance) => {
    const existingDuration = registry.getSingleMetric('http_server_request_duration_seconds');
    const reqDuration =
      existingDuration instanceof Histogram
        ? existingDuration
        : new Histogram({
            name: 'http_server_request_duration_seconds',
            help: 'HTTP request duration (seconds)',
            labelNames: ['method', 'route', 'status_code'] as const,
            buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
            registers: [registry],
          });

    const existingTotal = registry.getSingleMetric('http_server_requests_total');
    const reqTotal =
      existingTotal instanceof Counter
        ? existingTotal
        : new Counter({
            name: 'http_server_requests_total',
            help: 'HTTP requests count',
            labelNames: ['method', 'route', 'status_code'] as const,
            registers: [registry],
          });

    app.decorateRequest('_prom_end', undefined);

    app.addHook('onRequest', async (req) => {
      req._prom_end = reqDuration.startTimer();
    });

    app.addHook('onResponse', async (req, reply) => {
      const method = req.method;
      const route = routeLabel(req);
      const status_code = String(reply.statusCode);

      reqTotal.inc({ method, route, status_code });

      req._prom_end?.({ method, route, status_code });
    });
  },
  { name: 'prometheus-metrics' }
);
