import fp from 'fastify-plugin';
import { Counter } from 'prom-client';

export const importsSwept = new Counter({
  name: 'clearcost_imports_stale_swept_total',
  help: 'Number of imports marked failed by stale sweeper',
});

export default fp(async (app) => {
  app.decorate('importsSwept', importsSwept);
});
