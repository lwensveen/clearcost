import type { FastifyInstance } from 'fastify';
import fxRoutes from './fx-routes.js';
import vatRoutes from './vat-routes.js';
import ukDutyRoutes from './duties/uk-routes.js';
import euDutyRoutes from './duties/eu-routes.js';
import usDutyRoutes from './duties/us-routes.js';
import witsDutyRoutes from './duties/wits-routes.js';
import surchargeUsRoutes from './surcharges/us-routes.js';
import surchargeEuRoutes from './surcharges/eu-routes.js';
import surchargeUkRoutes from './surcharges/uk-routes.js';
import surchargeJsonRoute from './surcharges/generic-json.js';
import freightRoutes from './freight-routes.js';
import hsRoutes from './hs-routes.js';
import importsPruneRoutes from './prune-routes.js';
import poolRoutes from './pool-routes.js';
import sweepRoutes from './sweep-routes.js';

export default function taskRoutes(app: FastifyInstance) {
  euDutyRoutes(app);
  freightRoutes(app);
  fxRoutes(app);
  hsRoutes(app);
  importsPruneRoutes(app);
  poolRoutes(app);
  surchargeEuRoutes(app);
  surchargeJsonRoute(app);
  surchargeUkRoutes(app);
  surchargeUsRoutes(app);
  sweepRoutes(app);
  ukDutyRoutes(app);
  usDutyRoutes(app);
  vatRoutes(app);
  witsDutyRoutes(app);
}
