import fp from 'fastify-plugin';
import { Counter } from 'prom-client';
import { registry } from '../../lib/metrics.js';

export const importsSwept = new Counter({
  name: 'clearcost_imports_stale_swept_total',
  help: 'Number of imports marked failed by stale sweeper',
  registers: [registry],
});

export default fp(async (app) => {
  app.decorate('importsSwept', importsSwept);
});
