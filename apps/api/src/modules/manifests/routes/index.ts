import type { FastifyInstance } from 'fastify';
import manifestsCrud from './user/crud.js';
import manifestsBulk from './user/bulk.js';
import manifestsQuote from './user/quote.js';
import manifestsFull from './full.js';
import manifestsClone from './clone.js';
import manifestsCompute from './user/compute.js';

export default async function manifestsRoutes(app: FastifyInstance) {
  await app.register(manifestsCrud);
  await app.register(manifestsBulk);
  await app.register(manifestsQuote);
  await app.register(manifestsFull);
  await app.register(manifestsClone);
  await app.register(manifestsCompute);
}
