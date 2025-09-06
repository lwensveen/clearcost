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
import sweepRoutes from './sweep-routes.js';
import deMinimisRoutes from './de-minimis-routes.js';
import jpDutyRoutes from './duties/jp-routes.js';
import cnDutyRoutes from './duties/cn-routes.js';
import aseanDutyRoutes from './duties/asean/index.js';

export default function taskRoutes(app: FastifyInstance) {
  // Duties
  aseanDutyRoutes(app);
  cnDutyRoutes(app);
  euDutyRoutes(app);
  jpDutyRoutes(app);
  ukDutyRoutes(app);
  usDutyRoutes(app);
  witsDutyRoutes(app);

  // Surcharges
  surchargeEuRoutes(app);
  surchargeUkRoutes(app);
  surchargeUsRoutes(app);
  surchargeJsonRoute(app);

  // Other domains
  fxRoutes(app);
  vatRoutes(app);
  freightRoutes(app);
  hsRoutes(app);
  deMinimisRoutes(app);

  // Ops / utilities
  importsPruneRoutes(app);
  sweepRoutes(app);
}
