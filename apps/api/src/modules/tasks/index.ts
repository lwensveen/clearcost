import type { FastifyInstance } from 'fastify';
import aseanDutyRoutes from './duties/asean/index.js';
import cnDutyRoutes from './duties/cn-routes.js';
import deMinimisRoutes from './de-minimis-routes.js';
import dutyJsonRoute from './duties/generic-json.js';
import euDutyRoutes from './duties/eu-routes.js';
import freightRoutes from './freight-routes.js';
import fxRoutes from './fx-routes.js';
import hsRoutes from './hs-routes.js';
import importsPruneRoutes from './prune-routes.js';
import jpDutyRoutes from './duties/jp-routes.js';
import noticesRoutes from './notices-routes.js';
import surchargeEuRoutes from './surcharges/eu-routes.js';
import surchargeJsonRoute from './surcharges/generic-json.js';
import surchargeUkRoutes from './surcharges/uk-routes.js';
import surchargeUsRoutes from './surcharges/us-routes.js';
import sweepRoutes from './sweep-routes.js';
import ukDutyRoutes from './duties/uk-routes.js';
import usDutyRoutes from './duties/us-routes.js';
import vatRoutes from './vat-routes.js';
import witsDutyRoutes from './duties/wits-routes.js';

export default function taskRoutes(app: FastifyInstance) {
  // Duties
  aseanDutyRoutes(app);
  cnDutyRoutes(app);
  euDutyRoutes(app);
  jpDutyRoutes(app);
  ukDutyRoutes(app);
  usDutyRoutes(app);
  witsDutyRoutes(app);
  dutyJsonRoute(app);

  // Surcharges
  surchargeEuRoutes(app);
  surchargeUkRoutes(app);
  surchargeUsRoutes(app);
  surchargeJsonRoute(app);

  // Notices
  noticesRoutes(app);

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
